// Chrome's built-in model (Gemini Nano through the Prompt API): free and on the device, so a
// journey can run with no key. It has no tool calling, so the action comes back as constrained
// JSON instead.
import type { JourneyModel } from './model'
import { ACTION_TOOLS, parseAction, renderTurn, SYSTEM_PROMPT } from './prompt'

// The Prompt API is newer than the DOM types this project builds with.
interface PromptSession {
  prompt(input: string, options: { responseConstraint: object }): Promise<string>
  destroy(): void
}
interface LanguageModelApi {
  availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
  create(options: { initialPrompts: { role: 'system'; content: string }[] }): Promise<PromptSession>
}

function api(): LanguageModelApi | null {
  return (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel ?? null
}

/** True when this browser has the built-in model ready, or can download it. */
export async function chromeModelAvailable(): Promise<boolean> {
  const model = api()
  if (model === null) return false
  const state = await model.availability()
  return state !== 'unavailable'
}

// One flat object: the kind picks the action and the other fields carry its arguments.
const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ACTION_TOOLS.map((tool) => tool.name) },
    ...Object.assign({}, ...ACTION_TOOLS.map((tool) => tool.properties)),
  },
  required: ['kind'],
}

export function chromeModel(): JourneyModel {
  return {
    agent: 'Chrome built-in model (Gemini Nano) via Agent Ready',
    async next(turn) {
      const model = api()
      if (model === null) throw new Error('Chrome has no built-in model here')
      const session = await model.create({
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      })
      try {
        const reply = await session.prompt(
          `${renderTurn(turn)}\n\nAnswer with one JSON action: its kind and that tool's fields.`,
          { responseConstraint: ACTION_SCHEMA },
        )
        const parsed = JSON.parse(reply) as { kind?: unknown }
        return parseAction(typeof parsed.kind === 'string' ? parsed.kind : '', parsed)
      } finally {
        session.destroy()
      }
    },
  }
}
