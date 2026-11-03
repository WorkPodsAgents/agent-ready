import type { SecretName } from '@open-agent-ready/core/secrets'
import { anthropicModel } from './anthropic'
import { chromeModel } from './chrome-ai'
import { geminiModel } from './gemini'
import type { JourneyModel } from './model'
import { openaiModel } from './openai'

export type { JourneyModel, ModelTurn } from './model'
export { chromeModelAvailable } from './chrome-ai'

/** Where the panel's journeys get their model. The calling agent drives over the bridge instead. */
export type ModelSource = 'anthropic' | 'openai' | 'gemini' | 'chrome'

export const MODEL_SOURCE_LABEL: Readonly<Record<ModelSource, string>> = {
  anthropic: 'Claude (your Anthropic key)',
  openai: 'OpenAI (your key)',
  gemini: 'Gemini (your key)',
  chrome: 'Chrome built-in model (free)',
}

/** The vault secret each keyed source needs. */
export const SOURCE_SECRET: Readonly<Record<Exclude<ModelSource, 'chrome'>, SecretName>> = {
  anthropic: 'anthropic_key',
  openai: 'openai_key',
  gemini: 'gemini_key',
}

export function modelFor(
  source: ModelSource,
  key: string | null,
  fetchFn: typeof fetch,
): JourneyModel {
  if (source === 'chrome') return chromeModel()
  if (key === null) {
    throw new Error('No key for this model is unlocked. Add it or unlock the vault in Settings.')
  }
  switch (source) {
    case 'anthropic':
      return anthropicModel(key, fetchFn)
    case 'openai':
      return openaiModel(key, fetchFn)
    case 'gemini':
      return geminiModel(key, fetchFn)
  }
}
