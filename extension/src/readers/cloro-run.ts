// Unattended runs: the user's own Cloro key asks ChatGPT, Gemini and AI Mode in the service
// worker. The one place the readers use core's Cloro client; spend goes through the extension's
// ledger and response cache, so the monthly cap and the cache window hold here too.
import {
  CLORO_ESTIMATED_CREDITS,
  CLORO_USD_PER_CREDIT,
  createCloro,
  type Cloro,
} from '@open-agent-ready/core/providers'
import { ledger, paid, responseCache } from '../background/paid'
import { vault } from '../background/vault'
import type { Cost } from '../shared/api'
import { score, type Parties, type ScoredAnswer } from './answers-core'
import type { CloroEngine } from './cloro-engines'

// Built on first use: the readers barrel also reaches the side panel, which never asks Cloro.
let client: Cloro | null = null
function cloro(): Cloro {
  client ??= createCloro({
    ledger,
    cache: responseCache,
    apiKey: () => vault.get('cloro_key'),
    clock: () => Date.now(),
  })
  return client
}

/** The most a run of `prompts` prompts on `engines` can cost; cached answers cost less. */
export function estimateRun(prompts: number, engines: readonly CloroEngine[]): Cost {
  const credits = engines.reduce((sum, engine) => sum + CLORO_ESTIMATED_CREDITS[engine], 0)
  return { provider: 'cloro', usd: prompts * credits * CLORO_USD_PER_CREDIT }
}

export interface CloroAnswer {
  readonly scored: ScoredAnswer
  readonly cost: Cost
  readonly cached: boolean
}

/** Asks one prompt on one engine and scores the answer. Refused when it would pass the cap. */
export async function askCloro(
  engine: CloroEngine,
  prompt: string,
  parties: Parties,
): Promise<CloroAnswer> {
  const answer = await paid(() => cloro().ask({ engine, prompt }))
  return {
    scored: score(answer.data, parties),
    cost: { provider: 'cloro', usd: answer.costUsd },
    cached: answer.cached,
  }
}
