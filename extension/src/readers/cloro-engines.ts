import type { CloroEngine } from '@open-agent-ready/core/providers'

export type { CloroEngine }

/** The engines Cloro asks. Apart from the client, so the panel can list them without loading it. */
export const CLORO_ENGINES: readonly CloroEngine[] = ['chatgpt', 'gemini', 'ai_mode']
