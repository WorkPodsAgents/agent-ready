// The messages the panel and the report tab send the service worker, and the events it sends
// back. One map types both ends, so a renamed field fails the build instead of a click.
import type { FetchRequest, FetchResponse } from '@open-agent-ready/core'
import type {
  BacklinksSummary,
  CompetitorDomain,
  CompetitorGap,
  KeywordIdeas,
  KeywordView,
  LinkGap,
  Paid,
  Provider,
  ReferringDomains,
} from '@open-agent-ready/core/providers'
import type { SecretName } from '@open-agent-ready/core/secrets'
import type {
  CrawlProgress,
  ExportFile,
  ExportFormat,
  PageAudit,
  PageComparison,
  SiteFiles,
  SiteReport,
} from './results'
import type { Settings, Status } from './settings'

/** The arguments of every paid action; `estimate` prices any of them before it runs. */
export interface PaidArgs {
  'keywords:ideas': { seeds: readonly string[]; limit: number }
  /** One keyword's metrics with the strength of the domains in its top 10. */
  'keywords:view': { keyword: string }
  'competitors:discover': { domain: string; limit: number }
  'competitors:gap': { domain: string; competitors: readonly string[]; limit: number }
  'links:summary': { target: string }
  'links:referring': { target: string; limit: number }
  'links:gap': { domain: string; competitors: readonly string[]; limit: number }
}

export interface PaidResults {
  'keywords:ideas': KeywordIdeas
  'keywords:view': KeywordView | null
  'competitors:discover': readonly CompetitorDomain[]
  'competitors:gap': readonly CompetitorGap[]
  'links:summary': BacklinksSummary
  'links:referring': ReferringDomains
  'links:gap': LinkGap
}

export type PaidOp = keyof PaidArgs

/** Any one paid action with its arguments, as `estimate` takes it. */
export type PaidRequest = { [K in PaidOp]: { op: K; args: PaidArgs[K] } }[PaidOp]

/** An estimated price in US dollars, as the provider bills it. */
export interface Cost {
  readonly provider: Provider
  readonly usd: number
}

type PaidApi = { [K in PaidOp]: { in: PaidArgs[K]; out: Paid<PaidResults[K]> } }

export type ReportSubject = 'page' | 'site' | 'compare'

export interface Api extends PaidApi {
  'page:audit': { in: { brandName?: string }; out: PageAudit }
  'page:last': { in: Record<string, never>; out: PageAudit | null }
  'page:highlight': { in: { selector: string }; out: null }
  'site:files': { in: { url: string }; out: SiteFiles }
  'site:crawl': { in: { url: string; limit: number; pinned: readonly string[] }; out: SiteReport }
  'site:crawl:stop': { in: Record<string, never>; out: null }
  'site:last': { in: Record<string, never>; out: SiteReport | null }
  compare: { in: { url: string; competitorUrl: string }; out: PageComparison }
  'compare:last': { in: Record<string, never>; out: PageComparison | null }
  export: { in: { subject: ReportSubject; format: ExportFormat }; out: ExportFile }
  'keywords:suggest': { in: { seed: string }; out: string[] }
  estimate: { in: PaidRequest; out: Cost }
  status: { in: Record<string, never>; out: Status }
  'settings:save': { in: { settings: Settings }; out: Status }
  'vault:setup': { in: { passphrase: string; remember: boolean }; out: Status }
  'vault:unlock': { in: { passphrase: string; remember: boolean }; out: Status }
  'vault:lock': { in: Record<string, never>; out: Status }
  'vault:set': { in: { name: SecretName; value: string }; out: Status }
  'vault:remove': { in: { name: SecretName }; out: Status }
  'spend:cap': { in: { provider: Provider; usd: number }; out: Status }
  'data:wipe': { in: Record<string, never>; out: Status }
  /** The results page reader's "check this result" and "compare with this result". */
  'serp:audit-url': { in: { url: string }; out: null }
  'serp:compare-url': { in: { url: string }; out: null }
  /** The offscreen document's network requests, made by the service worker. */
  'net:fetch': { in: FetchRequest; out: FetchResponse }
}

export type ApiType = keyof Api

/** Asks the panel to show a screen, with the URL it should work on. */
export type PanelOpen =
  { readonly screen: 'page' } | { readonly screen: 'competitors'; readonly competitorUrl: string }

export interface Events {
  'crawl:progress': CrawlProgress
  /** A finished crawl, saved; screens that show the last crawl stay mounted and need it. */
  'crawl:saved': SiteReport
  status: Status
  'panel:open': PanelOpen
}

export type EventName = keyof Events

/** A request on the runtime message channel; messages with a `target` belong to other parts. */
export interface ApiRequest {
  readonly type: string
  readonly payload: unknown
}

export type ApiReply =
  { readonly ok: true; readonly result: unknown } | { readonly ok: false; readonly error: string }

export interface PanelEvent {
  readonly target: 'panel'
  readonly event: EventName
  readonly data: unknown
}

export function isApiRequest(message: unknown): message is ApiRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    !('target' in message) &&
    'type' in message &&
    typeof message.type === 'string'
  )
}
