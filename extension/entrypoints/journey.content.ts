import { answerCall, JOURNEY_GLOBAL, type InPageCall } from '../src/journeys/in-page'

// Injected into a journey's scratch tab only, by the service worker before each step. It reads
// and acts on the page the way an agent browser does; the policy has already approved each act.
export default defineContentScript({
  registration: 'runtime',
  main() {
    const scope = globalThis as Record<symbol, unknown>
    const key = Symbol.for(JOURNEY_GLOBAL)
    // The worker injects before every call, so a second injection keeps the first's refs.
    if (scope[key] !== undefined) return
    const refs = { last: 0 }
    scope[key] = (call: InPageCall) => answerCall(document, refs, call)
  },
})
