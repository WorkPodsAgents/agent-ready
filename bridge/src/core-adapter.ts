// The one file that calls the page, site and crawl checks, so a change to their signatures
// touches only this file. Everything here runs in Node with no browser, for the CLI and for the
// MCP tools when the extension is not connected. The result shapes follow the extension's own
// (extension/src/shared/results.ts), so an agent reads the same fields either way.
import type { Finding } from '@open-agent-ready/core'
import { crawlSite } from '@open-agent-ready/core/crawl'
import type { CrawlReport, StoppedReason } from '@open-agent-ready/core/crawl'
import { auditPage, fetchPage } from '@open-agent-ready/core/page'
import { isProblem } from '@open-agent-ready/core/report'
import type { SiteReport } from '@open-agent-ready/core/report'
import { probeSiteFiles } from '@open-agent-ready/core/site'
import type { SiteFacts, SitemapRead } from '@open-agent-ready/core/site'
import { nodeFetcher, parseHtml, sleep } from './node-io'

export const NO_BROWSER_NOTE =
  'Ran without a browser, so the checks that compare the raw HTML with the rendered page, and ' +
  'the speed checks, were not applicable. Open Chrome with the Agent Ready extension for ' +
  'those.'

export interface NodePageAudit {
  readonly url: string
  readonly status: number
  readonly findings: readonly Finding[]
  readonly notes: readonly string[]
}

export interface NodeSiteFiles {
  readonly origin: string
  readonly facts: SiteFacts
  readonly sitemap: SitemapRead
  readonly findings: readonly Finding[]
}

/**
 * Fetches the page, then its site's files from the origin it landed on, so the robots checks
 * judge the page against the robots.txt that governs it.
 */
export async function checkInNode(
  url: string,
  brandName: string | null,
): Promise<{ page: NodePageAudit; site: NodeSiteFiles }> {
  const snapshot = await fetchPage(nodeFetcher, parseHtml, url)
  const probe = await probeSiteFiles(snapshot.url, nodeFetcher)
  const findings = auditPage(snapshot, { robots: probe.robots, brandName })
  return {
    page: { url: snapshot.url, status: snapshot.status, findings, notes: [NO_BROWSER_NOTE] },
    site: {
      origin: probe.origin,
      facts: probe.facts,
      sitemap: probe.sitemap,
      findings: probe.findings,
    },
  }
}

export async function siteFilesInNode(url: string): Promise<NodeSiteFiles> {
  const probe = await probeSiteFiles(url, nodeFetcher)
  return {
    origin: probe.origin,
    facts: probe.facts,
    sitemap: probe.sitemap,
    findings: probe.findings,
  }
}

export async function crawlInNode(
  url: string,
  limit: number,
  pinned: readonly string[],
  progress: (line: string) => void,
): Promise<CrawlReport> {
  return crawlSite({
    start: url,
    pinned,
    limit,
    fetcher: nodeFetcher,
    parse: parseHtml,
    sleep,
    // Ctrl+C ends the process, so nothing here needs to stop a crawl part way.
    signal: new AbortController().signal,
    onProgress: (done, queued, at) => progress(`Crawled ${done}, ${queued} queued: ${at}`),
  })
}

/** The extension's crawl result shape, for the crawl_site tool. */
export function crawlResult(report: CrawlReport) {
  return {
    startUrl: report.origin,
    stop: CRAWL_STOP[report.stoppedReason],
    pages: report.pages.map((page) => ({
      url: page.url,
      status: page.status,
      title: page.title,
      wordCount: page.wordCount,
      // Only problems per page, so 200 pages of results stay a size an agent can read.
      findings: page.findings.filter(isProblem),
    })),
    findings: report.findings,
    notes: crawlNotes(report),
  }
}

const CRAWL_STOP: Readonly<Record<StoppedReason, 'complete' | 'limit' | 'stopped'>> = {
  done: 'complete',
  limit: 'limit',
  aborted: 'stopped',
}

/** The crawl as the readable site report: its cross-page findings and what it left out. */
export function siteReport(report: CrawlReport, limit: number): SiteReport {
  const stopReason: Readonly<Record<StoppedReason, string | null>> = {
    done: null,
    limit: `reached the ${limit}-page limit`,
    aborted: 'stopped by the user',
  }
  return {
    kind: 'site',
    url: report.origin,
    pagesCrawled: report.pages.length,
    stopReason: stopReason[report.stoppedReason],
    findings: report.findings,
    notes: crawlNotes(report),
  }
}

function crawlNotes(report: CrawlReport): string[] {
  const notes = [NO_BROWSER_NOTE]
  const failing = report.pages.filter((page) => page.findings.some(isProblem)).length
  if (failing > 0) {
    notes.push(
      `${failing} of ${report.pages.length} crawled pages fail at least one check; run ` +
        '`check <url>` on a page for its details.',
    )
  }
  if (report.blockedByRobots.length > 0) {
    notes.push(
      `${report.blockedByRobots.length} pages were not fetched because robots.txt disallows them.`,
    )
  }
  if (report.unreachable.length > 0) {
    notes.push(`${report.unreachable.length} pages gave no answer.`)
  }
  return notes
}
