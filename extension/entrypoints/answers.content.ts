import { awaitAnswer, fillPrompt } from '../src/readers/assist'
import { isContentMessage } from '../src/readers/content-messages'
import { engineFor } from '../src/readers/engines'

/** How long the answer must stay unchanged after the engine stops writing. */
const QUIET_MS = 1500
const POLL_MS = 500

const INSTALLED = Symbol.for('open-agent-ready.answers')

// Reads AI answers in the user's own session on each engine, injected only on engines the user
// allowed and only when asked. It answers the panel's and the service worker's requests; it
// sends nothing on its own and never submits a prompt.
export default defineContentScript({
  registration: 'runtime',
  main() {
    const scope = globalThis as { [INSTALLED]?: true }
    // Every request injects the script first, so a second injection must not listen twice.
    if (scope[INSTALLED]) return
    scope[INSTALLED] = true
    const pageUrl = () => location.href
    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const adapter = engineFor(pageUrl())
      if (adapter === null) return undefined
      if (isContentMessage(message, 'answers:read')) {
        sendResponse(adapter.read(document, pageUrl()))
        return undefined
      }
      if (isContentMessage(message, 'answers:fill')) {
        const input = adapter.promptInput(document)
        const before = adapter.read(document, pageUrl())?.text ?? null
        if (input !== null) fillPrompt(input, message.payload.prompt)
        sendResponse({ filled: input !== null, before })
        return undefined
      }
      if (isContentMessage(message, 'answers:await')) {
        void awaitAnswer(document, adapter, pageUrl, {
          before: message.payload.before,
          quietMs: QUIET_MS,
          timeoutMs: message.payload.timeoutMs,
          pollMs: POLL_MS,
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        }).then(sendResponse)
        // Keeps the channel open until the answer arrives.
        return true
      }
      return undefined
    })
  },
})
