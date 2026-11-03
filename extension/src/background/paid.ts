// The one file that wires the paid-provider lane: the spend ledger, the response cache and the
// DataForSEO client, with its credentials read from the vault at call time. Every paid action
// passes the cache first, then the monthly cap, inside core.
import {
  backlinksPrice,
  createDataForSeo,
  createResponseCache,
  createSpendLedger,
  labsPrice,
  ProviderError,
  type Market,
  type ProviderFailure,
  type ResponseCache,
  serpLivePrice,
} from '@open-agent-ready/core/providers'
import { VaultError } from '@open-agent-ready/core/secrets'
import type { Cost, PaidRequest } from '../shared/api'
import { formatUsd, PROVIDER_LABEL } from '../shared/cost'
import { readSettings } from './settings'
import { cacheStore, localStore } from './stores'
import { vault } from './vault'

const clock = () => Date.now()
const DAY_MS = 86_400_000

export const ledger = createSpendLedger({ storage: localStore, clock })

// The cache window is a setting, so the cache reads it on every lookup.
const cache: ResponseCache = {
  async get(provider, endpoint, body) {
    const ttlMs = (await readSettings()).cacheDays * DAY_MS
    return createResponseCache({ storage: cacheStore, clock, ttlMs }).get(provider, endpoint, body)
  },
  put: (provider, endpoint, body, response) =>
    createResponseCache({ storage: cacheStore, clock }).put(provider, endpoint, body, response),
}

export const dataForSeo = createDataForSeo({
  ledger,
  cache,
  async credentials() {
    const [login, password] = await Promise.all([
      vault.get('dataforseo_login'),
      vault.get('dataforseo_password'),
    ])
    return login === null || password === null ? null : { login, password }
  },
})

export { cache as responseCache }

/** The most an action can cost, from the provider's list prices; a cached answer costs less. */
export function estimate(request: PaidRequest): Cost {
  const usd = (() => {
    switch (request.op) {
      case 'keywords:ideas':
        return labsPrice(request.args.limit)
      case 'keywords:view':
        return labsPrice(1) + serpLivePrice(10)
      case 'competitors:discover':
        return labsPrice(request.args.limit)
      case 'competitors:gap':
        return labsPrice(request.args.limit) * request.args.competitors.length
      case 'links:summary':
        return backlinksPrice(1)
      case 'links:referring':
      case 'links:gap':
        return backlinksPrice(request.args.limit)
    }
  })()
  return { provider: 'dataforseo', usd }
}

/** The market every DataForSEO action uses unless a tool call names another. */
export function market(location?: string, language?: string): Market {
  return {
    ...(location === undefined ? {} : { location }),
    ...(language === undefined ? {} : { language }),
  }
}

/** A provider failure in plain words; the failure never carries provider text or a secret. */
export function failureText(failure: ProviderFailure): string {
  const name = PROVIDER_LABEL[failure.provider]
  switch (failure.code) {
    case 'not_configured':
      return `Add your ${name} credentials in Settings first.`
    case 'auth_failed':
      return `${name} did not accept your credentials. Check them in Settings.`
    case 'no_access':
      return (
        `Your ${name} account has no access to this data. ` +
        'Backlinks need their own subscription.'
      )
    case 'no_funds':
      return `Your ${name} balance cannot pay for this. Top it up with ${name}.`
    case 'rate_limited':
      return `${name} asked to slow down. Try again in ${failure.retryAfterS} seconds.`
    case 'cap_not_set':
      return `Set a monthly ${name} cap in Settings before the first paid call.`
    case 'over_cap':
      return (
        `This costs about ${formatUsd(failure.estimateUsd)}, and ` +
        `${formatUsd(Math.max(0, failure.capUsd - failure.spentUsd))} is left of this month's ` +
        `${name} cap. Raise the cap in Settings to run it.`
      )
    case 'refused':
      return `${name} refused the request (code ${failure.status}).`
    case 'invalid_input':
      return `${name} cannot use that ${failure.field}.`
    case 'unavailable':
      return `${name} is not answering right now. Try again later.`
    case 'invalid_response':
      return `${name} sent an answer this version cannot read.`
  }
}

/** Runs a paid call, turning a provider failure into a message the user can act on. */
export async function paid<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (error instanceof ProviderError) throw new Error(failureText(error.failure))
    if (error instanceof VaultError && error.code === 'locked') {
      throw new Error('Unlock the vault in Settings to use your provider keys.')
    }
    throw error
  }
}
