// The journey script's one entry point inside the scratch tab. The service worker injects the
// script, then calls this through scripting.executeScript, so every answer is plain data.
import { describeRef, performOn, type PageAction } from './act'
import { readPage, type RefCounter } from './observe'

/** The global the script installs under, as `Symbol.for(JOURNEY_GLOBAL)` in the isolated world. */
export const JOURNEY_GLOBAL = 'open-agent-ready.journey'

export type InPageCall =
  | { readonly op: 'observe' }
  | { readonly op: 'describe'; readonly ref: string }
  | { readonly op: 'perform'; readonly action: PageAction }

/** A page error comes back as a value: executeScript drops thrown errors' messages. */
export type InPageReply =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }

export function answerCall(doc: Document, refs: RefCounter, call: InPageCall): InPageReply {
  try {
    switch (call.op) {
      case 'observe':
        return { ok: true, value: readPage(doc, refs) }
      case 'describe':
        return { ok: true, value: describeRef(doc, call.ref) }
      case 'perform':
        performOn(doc, call.action)
        return { ok: true, value: null }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The page threw an error.' }
  }
}
