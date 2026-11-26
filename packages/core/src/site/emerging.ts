// Emerging agent standards: early drafts that few agents read yet. Each is reported as found or
// not, for the site files view only; none feeds a finding, a verdict or a score, so a site is
// never marked down for skipping a draft. Sources:
// - Search for Agents: Cloudflare's AI Search how-to (developers.cloudflare.com/ai-search/how-to/
//   search-for-agents). GET /.well-known/search?q= answers in Markdown; like isitagentready.com,
//   an Accept-Query header or a "# Search results for:" heading tells it from an ordinary page.
// - Auth.md: isitagentready.com's auth-md skill. /auth.md is Markdown whose H1 names auth.md.
// - Poppy: Personal Agent Protocol section 3 (personalagentprotocol.org/docs/spec).
//   /.well-known/poppy.json has a Major.Minor protocol_version and an organization with a name and
//   a domain, the domain being the host that served the file.
// DNS-AID (draft-mozleywilliams-dnsop-dnsaid) is left out: reading SVCB records from a browser
// needs a DNS-over-HTTPS resolver, which would tell a third party every domain checked.
import type { Fetcher, FetchResponse } from '../io'
import { isObject, parseObject, stringOf } from './agent-manifests'
import { fetchFile, mediaType } from './fetch-file'
import { outcomeOf } from './outcome'

export type EmergingStandard = 'search_for_agents' | 'auth_md' | 'poppy'

/** found: the site serves it. absent: it does not. unread: the site refused or did not answer. */
export type EmergingStatus = 'found' | 'absent' | 'unread'

export interface EmergingSignal {
  readonly standard: EmergingStandard
  readonly url: string
  readonly status: EmergingStatus
}

/** A neutral query, so the request says nothing about who asked or why. */
const SEARCH_QUERY = 'about'
const SEARCH_HEADING = /^# search results for:/i
const AUTH_MD_H1 = /^# .*auth\.md/im
const MAJOR_MINOR = /^\d+\.\d+$/

interface Probe {
  readonly standard: EmergingStandard
  readonly path: string
  readonly accept: string
  readonly served: (response: FetchResponse, landed: string) => boolean
}

const PROBES: readonly Probe[] = [
  {
    standard: 'search_for_agents',
    path: `/.well-known/search?q=${SEARCH_QUERY}`,
    accept: 'text/markdown',
    served: (response) =>
      mediaType(response) === 'text/markdown' &&
      (response.headers['accept-query'] !== undefined ||
        SEARCH_HEADING.test(response.body.trimStart())),
  },
  {
    standard: 'auth_md',
    path: '/auth.md',
    accept: 'text/markdown, text/plain',
    served: (response) => !isHtml(response) && AUTH_MD_H1.test(response.body),
  },
  {
    standard: 'poppy',
    path: '/.well-known/poppy.json',
    accept: 'application/json',
    served: (response, landed) => poppy(response.body, new URL(landed).host),
  },
]

export async function readEmergingSignals(
  fetcher: Fetcher,
  origin: string,
): Promise<EmergingSignal[]> {
  const signals: EmergingSignal[] = []
  for (const probe of PROBES) {
    const url = `${origin}${probe.path}`
    const answer = await fetchFile(fetcher, url, probe.accept)
    const outcome = outcomeOf(answer)
    const status: EmergingStatus =
      outcome === 'blocked' || outcome === 'failed'
        ? 'unread'
        : outcome === 'ok' && answer.response !== null && probe.served(answer.response, answer.url)
          ? 'found'
          : 'absent'
    signals.push({ standard: probe.standard, url, status })
  }
  return signals
}

/** Poppy section 3.1: organization.domain is the serving host, compared ignoring case. */
function poppy(text: string, host: string): boolean {
  const root = parseObject(text)
  const organization = root?.['organization']
  if (root === null || !isObject(organization)) return false
  const version = stringOf(root['protocol_version'])
  const name = stringOf(organization['name'])?.trim() ?? ''
  const domain = stringOf(organization['domain'])?.toLowerCase()
  return version !== null && MAJOR_MINOR.test(version) && name !== '' && domain === host
}

function isHtml(response: FetchResponse): boolean {
  const head = response.body.trimStart().slice(0, 64).toLowerCase()
  const type = mediaType(response)
  return (
    type === 'text/html' ||
    type === 'application/xhtml+xml' ||
    head.startsWith('<!doctype') ||
    head.startsWith('<html')
  )
}
