// Claude through the Messages API with the user's own key, called from the service worker. The
// SDK is not bundled: one request shape is all a journey needs.
import { ANTHROPIC_MODEL } from './ids'
import type { JourneyModel } from './model'
import { ACTION_TOOLS, inputSchema, parseAction, renderTurn, SYSTEM_PROMPT } from './prompt'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'

interface ContentBlock {
  readonly type: string
  readonly name?: string
  readonly input?: unknown
}

export function anthropicModel(key: string, fetchFn: typeof fetch): JourneyModel {
  return {
    agent: `Claude (${ANTHROPIC_MODEL}) via Agent Ready`,
    async next(turn) {
      const response = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          // The key is the user's own and stays in the service worker; this header is how the API
          // accepts a call from a browser context.
          'anthropic-dangerous-direct-browser-access': 'true',
          // A refused request is re-run on the fallback model the API picks, instead of failing.
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          output_config: { effort: 'low' },
          fallbacks: 'default',
          system: SYSTEM_PROMPT,
          // This model refuses a forced tool choice; the prompt asks for exactly one tool call.
          tool_choice: { type: 'auto', disable_parallel_tool_use: true },
          tools: ACTION_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: inputSchema(tool),
            strict: true,
          })),
          messages: [{ role: 'user', content: renderTurn(turn) }],
        }),
      })
      if (!response.ok) throw new Error(`Anthropic answered ${response.status}`)
      const body = (await response.json()) as { stop_reason?: string; content?: ContentBlock[] }
      if (body.stop_reason === 'refusal') throw new Error('Claude declined this step')
      const call = body.content?.find((block) => block.type === 'tool_use')
      if (call?.name === undefined) throw new Error('Claude did not choose an action')
      return parseAction(call.name, call.input)
    },
  }
}
