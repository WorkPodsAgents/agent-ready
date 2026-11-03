import { blockText, citedLinks, firstOf, lastOf } from './extract'
import type { EngineAdapter } from './types'

// Claude flags every assistant message with data-is-streaming, which is both the turn hook and
// the end-of-answer signal.
const ANSWER = ['[data-is-streaming]', '.font-claude-response', '.font-claude-message']
const BODY = ['.standard-markdown', '.progressive-markdown', '[class*="markdown"]']
const QUESTION = ['[data-testid="user-message"]', '.font-user-message']
const INPUT = [
  'div[contenteditable="true"][aria-label*="prompt" i]',
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"]',
  'textarea',
]

export const claude: EngineAdapter = {
  id: 'claude',
  matches: (url) => url.hostname === 'claude.ai',
  read(doc, pageUrl) {
    const turn = lastOf(doc, ANSWER)
    if (turn === null) return null
    const body = firstOf(turn, BODY) ?? turn
    const question = lastOf(doc, QUESTION)
    return {
      engine: 'claude',
      pageUrl,
      prompt: question === null ? null : blockText(question),
      text: blockText(body),
      citations: citedLinks([turn], pageUrl, ['claude.ai', 'anthropic.com']),
      streaming: turn.getAttribute('data-is-streaming') === 'true',
    }
  },
  promptInput: (doc) => firstOf(doc, INPUT) as HTMLElement | null,
}
