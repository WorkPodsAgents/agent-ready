import type { ApiReply } from '../shared/api'
import { emit } from '../shared/events'
import { isOffscreenCall, type OffscreenOp, type OffscreenOps } from '../shared/offscreen'
import { crawl, stopCrawl } from './crawl'
import { audit, seeAsAgent } from './page'

type Ops = { [K in OffscreenOp]: (input: OffscreenOps[K]['in']) => Promise<OffscreenOps[K]['out']> }

export const OPS: Ops = {
  audit: (input) => audit(input.url, input.rendered, input.brandName),
  see: (input) => seeAsAgent(input.url, input.rendered),
  crawl: (input) => crawl(input, (data) => emit('crawl:progress', data)),
  'crawl:stop': async () => {
    stopCrawl()
    return null
  },
}

/** Answers the service worker's calls; every other message on the channel is someone else's. */
export function serve(): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isOffscreenCall(message) || sender.id !== browser.runtime.id) return undefined
    const op = OPS[message.op] as (input: unknown) => Promise<unknown>
    op(message.input).then(
      (result) => sendResponse({ ok: true, result } satisfies ApiReply),
      (error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies ApiReply),
    )
    return true
  })
}
