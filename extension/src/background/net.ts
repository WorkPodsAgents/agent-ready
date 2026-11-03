import { extensionFetcher } from './fetcher'
import { handle } from './handle'

/** The offscreen document's requests, made here where redirect hops are visible. */
export function registerNetHandlers(): void {
  handle('net:fetch', (request) => extensionFetcher.fetch(request))
}
