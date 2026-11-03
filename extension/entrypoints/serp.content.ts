import { isContentMessage } from '../src/readers/content-messages'
import { readSerp } from '../src/readers/serp/read-serp'

const INSTALLED = Symbol.for('open-agent-ready.serp')

// Reads the Google results page the user has open, injected when the side panel asks for it on a
// Google domain the user allowed.
export default defineContentScript({
  registration: 'runtime',
  main() {
    const scope = globalThis as { [INSTALLED]?: true }
    if (scope[INSTALLED]) return
    scope[INSTALLED] = true
    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isContentMessage(message, 'serp:read')) return undefined
      sendResponse(readSerp(document, location.href))
      return undefined
    })
  },
})
