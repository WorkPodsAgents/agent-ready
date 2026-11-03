// OpenAI through the Responses API with the user's own key, called from the service worker.
import { OPENAI_MODEL } from './ids'
import type { JourneyModel } from './model'
import { ACTION_TOOLS, inputSchema, parseAction, renderTurn, SYSTEM_PROMPT } from './prompt'

const ENDPOINT = 'https://api.openai.com/v1/responses'

interface OutputItem {
  readonly type: string
  readonly name?: string
  readonly arguments?: string
}

export function openaiModel(key: string, fetchFn: typeof fetch): JourneyModel {
  return {
    agent: `OpenAI (${OPENAI_MODEL}) via Agent Ready`,
    async next(turn) {
      const response = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          instructions: SYSTEM_PROMPT,
          input: renderTurn(turn),
          tool_choice: 'required',
          parallel_tool_calls: false,
          // Nothing about a journey needs to be kept on OpenAI's side.
          store: false,
          tools: ACTION_TOOLS.map((tool) => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: inputSchema(tool),
            strict: true,
          })),
        }),
      })
      if (!response.ok) throw new Error(`OpenAI answered ${response.status}`)
      const body = (await response.json()) as { output?: OutputItem[] }
      const call = body.output?.find((item) => item.type === 'function_call')
      if (call?.name === undefined) throw new Error('OpenAI did not choose an action')
      return parseAction(call.name, JSON.parse(call.arguments ?? '{}'))
    },
  }
}
