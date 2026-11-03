// The calls the service worker makes into the offscreen document. The page checks and the crawl
// need a parsed Document and a service worker has no DOMParser, so they run there and only plain
// JSON comes back. Their network requests come back to the service worker (`net:fetch`), which
// alone can see redirect hops.
import type { Vitals } from '@open-agent-ready/core'
import type { PageAudit, SiteReport } from './results'

export interface RenderedPage {
  readonly html: string
  readonly vitals: Vitals | null
}

/** What `see_as_agent` returns: both versions of the page, cut to a size a tool result holds. */
export interface AgentView {
  readonly url: string
  readonly status: number
  readonly rawHtml: string
  readonly renderedHtml: string | null
  /** True when either HTML was cut to HTML_LIMIT characters. */
  readonly truncated: boolean
  readonly audit: PageAudit
}

export interface OffscreenOps {
  audit: {
    in: { url: string; rendered: RenderedPage | null; brandName: string | null }
    out: PageAudit
  }
  see: { in: { url: string; rendered: RenderedPage | null }; out: AgentView }
  crawl: { in: { url: string; limit: number; pinned: readonly string[] }; out: SiteReport }
  'crawl:stop': { in: Record<string, never>; out: null }
}

export type OffscreenOp = keyof OffscreenOps

export interface OffscreenCall {
  readonly target: 'offscreen'
  readonly op: OffscreenOp
  readonly input: unknown
}

export function isOffscreenCall(message: unknown): message is OffscreenCall {
  return (
    typeof message === 'object' &&
    message !== null &&
    'target' in message &&
    message.target === 'offscreen'
  )
}

/** The page content script's commands; it runs in the user's tab and never sees a secret. */
export type PageCommand =
  | { readonly target: 'page'; readonly op: 'snapshot' }
  | { readonly target: 'page'; readonly op: 'highlight'; readonly selector: string }
