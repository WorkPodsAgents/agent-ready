import type { Browser } from 'wxt/browser'
import type { Api, ApiType } from '../shared/api'
import { registerHandler, type Handler } from './router'

/**
 * Registers a panel handler. Content scripts share the message channel and run inside pages the
 * extension does not trust, so only the extension's own pages (and the bridge link, which calls
 * the router directly with no sender) may reach these handlers.
 */
export function handle<K extends ApiType>(
  type: K,
  handler: (payload: Api[K]['in']) => Promise<Api[K]['out']>,
): void {
  registerHandler(type, (payload, sender) => {
    if (!fromExtensionPage(sender)) throw new Error(`${type} is only open to the extension`)
    // The sender is the extension's own page, built against the same Api map.
    return handler(payload as Api[K]['in'])
  })
}

export function fromExtensionPage(sender: Browser.runtime.MessageSender | null): boolean {
  if (sender === null) return true
  return sender.url?.startsWith(browser.runtime.getURL('/')) === true
}

/** Opens an untyped handler to the extension's own pages and the bridge link only. */
export function trusted(handler: (payload: unknown) => Promise<unknown>): Handler {
  return (payload, sender) => {
    if (!fromExtensionPage(sender)) throw new Error('This action is only open to the extension.')
    return handler(payload)
  }
}
