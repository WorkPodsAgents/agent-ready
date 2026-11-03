// Gemini through the Gemini API with the user's own key, called from the service worker.
import { GEMINI_MODEL } from './ids'
import type { JourneyModel } from './model'
import { ACTION_TOOLS, parseAction, renderTurn, SYSTEM_PROMPT } from './prompt'

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/' + `${GEMINI_MODEL}:generateContent`

interface Part {
  readonly functionCall?: { readonly name?: string; readonly args?: unknown }
}

export function geminiModel(key: string, fetchFn: typeof fetch): JourneyModel {
  return {
    agent: `Gemini (${GEMINI_MODEL}) via Agent Ready`,
    async next(turn) {
      const response = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: renderTurn(turn) }] }],
          // Gemini's schema dialect has no additionalProperties, so it gets the bare shape.
          tools: [
            {
              functionDeclarations: ACTION_TOOLS.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: {
                  type: 'object',
                  properties: tool.properties,
                  required: Object.keys(tool.properties),
                },
              })),
            },
          ],
          toolConfig: { functionCallingConfig: { mode: 'ANY' } },
        }),
      })
      if (!response.ok) throw new Error(`Gemini answered ${response.status}`)
      const body = (await response.json()) as {
        candidates?: { content?: { parts?: Part[] } }[]
      }
      const parts = body.candidates?.[0]?.content?.parts ?? []
      const call = parts.find((part) => part.functionCall !== undefined)?.functionCall
      if (call?.name === undefined) throw new Error('Gemini did not choose an action')
      return parseAction(call.name, call.args)
    },
  }
}
