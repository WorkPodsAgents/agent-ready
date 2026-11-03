// The results the service worker hands to the panel, the report tab and the bridge. They are plain
// JSON, because they cross runtime messages and the bridge socket, and they never carry a secret.
import type { Finding, Layer, Status, Vitals } from '@open-agent-ready/core'
import type { SiteFacts, SitemapRead } from '@open-agent-ready/core/site'

/** What an AI fetcher reads next to what a person sees: the "See as AI" view. */
export interface AiView {
  readonly rawWords: number
  /** Null when no rendered page was available, such as a URL audited from the bridge. */
  readonly renderedWords: number | null
  readonly rawJsonLdTypes: readonly string[]
  readonly renderedJsonLdTypes: readonly string[] | null
  /** The visible text each side carries, cut to TEXT_PREVIEW characters. */
  readonly rawText: string
  readonly renderedText: string | null
}

export interface PageAudit {
  readonly url: string
  readonly status: number
  readonly findings: readonly Finding[]
  readonly view: AiView
  readonly vitals: Vitals | null
  /** ISO time the audit ran. */
  readonly auditedAt: string
}

/** The site files probe, without the parsed robots.txt object, which cannot cross a message. */
export interface SiteFiles {
  readonly origin: string
  readonly facts: SiteFacts
  readonly sitemap: SitemapRead
  readonly findings: readonly Finding[]
  readonly checkedAt: string
}

/** One crawled page as the site report lists it. */
export interface SitePage {
  readonly url: string
  readonly status: number
  readonly title: string | null
  readonly wordCount: number
  readonly findings: readonly Finding[]
}

export type CrawlStop = 'complete' | 'limit' | 'stopped'

export interface SiteReport {
  readonly startUrl: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly stop: CrawlStop
  readonly pages: readonly SitePage[]
  /** Cross-page findings: duplicates, orphans, depth, broken links, hreflang return links. */
  readonly findings: readonly Finding[]
  /** Pages found but not crawled because robots.txt keeps the crawler out. */
  readonly blockedByRobots: number
}

/** Why pages were left out: a site closed to crawlers otherwise reads as an empty crawl. */
export function blockedText(report: SiteReport): string | null {
  const blocked = report.blockedByRobots
  if (blocked === 0) return null
  const pages = blocked === 1 ? '1 page' : `${blocked} pages`
  return `robots.txt keeps the crawler out of ${pages} it found, so they were not checked.`
}

export interface CrawlProgress {
  readonly done: number
  readonly limit: number
  readonly currentUrl: string | null
}

export interface ComparedSide {
  readonly url: string
  readonly status: number
  readonly view: AiView
  readonly findings: readonly Finding[]
}

export interface PageComparison {
  readonly mine: ComparedSide
  readonly theirs: ComparedSide
}

export interface ExportFile {
  readonly filename: string
  readonly mime: string
  readonly text: string
}

export type ExportFormat = 'markdown' | 'json' | 'csv'

/** Pass ratio of one layer: checks that passed over checks that could be judged. */
export interface LayerScore {
  readonly layer: Layer
  readonly passed: number
  readonly judged: number
  /** Checks that had nothing to judge on this page, such as WebMCP tools the page lacks. */
  readonly untested: number
}

export type { Finding, Status }
