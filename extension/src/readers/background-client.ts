import { browser } from 'wxt/browser'
import type { ApiReply } from '../shared/api'

/** Sends `{ type, payload }` to the service worker's router and unwraps its reply. */
export async function callBackground<T>(type: string, payload: unknown): Promise<T> {
  const reply = (await browser.runtime.sendMessage({ type, payload })) as ApiReply | undefined
  if (reply === undefined) throw new Error('The extension did not answer. Reload it and try again.')
  if (!reply.ok) throw new Error(reply.error)
  // The handler for `type` returns T; the router carries it untyped.
  return reply.result as T
}
