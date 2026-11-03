import { chatgpt } from './chatgpt'
import { claude } from './claude'
import { gemini } from './gemini'
import { googleAiMode, googleAiOverview } from './google'
export { isGoogleSearch } from './google'
import { perplexity } from './perplexity'
import type { EngineAdapter } from './types'

export type { CitedSource, EngineAdapter, EngineId, ReadAnswer } from './types'
export { ENGINE_LABEL } from './types'

export const ENGINES: readonly EngineAdapter[] = [
  chatgpt,
  gemini,
  claude,
  perplexity,
  googleAiMode,
  googleAiOverview,
]

/** The adapter that reads `url`, or null when no supported engine serves it. */
export function engineFor(url: string): EngineAdapter | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return ENGINES.find((engine) => engine.matches(parsed)) ?? null
}
