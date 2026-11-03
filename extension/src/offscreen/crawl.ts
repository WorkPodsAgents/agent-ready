// The one file that calls the crawl lane's entry point, so a change to its signature touches only
// this file.
import { crawlSite, type CrawlReport, type StoppedReason } from '@open-agent-ready/core/crawl'
import type { CrawlProgress, CrawlStop, SiteReport } from '../shared/results'
import { parseHtml, relayFetcher, sleep } from './fetcher'

const STOP: Readonly<Record<StoppedReason, CrawlStop>> = {
  done: 'complete',
  limit: 'limit',
  aborted: 'stopped',
}

let running: AbortController | null = null

export async function crawl(
  input: { url: string; limit: number; pinned: readonly string[] },
  onProgress: (progress: CrawlProgress) => void,
): Promise<SiteReport> {
  if (running !== null) throw new Error('A crawl is already running. Stop it first.')
  const controller = new AbortController()
  running = controller
  const startedAt = new Date().toISOString()
  try {
    onProgress({ done: 0, limit: input.limit, currentUrl: input.url })
    const report = await crawlSite({
      start: input.url,
      pinned: input.pinned,
      limit: input.limit,
      fetcher: relayFetcher,
      parse: parseHtml,
      sleep,
      signal: controller.signal,
      onProgress: (done, _queued, url) => onProgress({ done, limit: input.limit, currentUrl: url }),
    })
    return siteReport(input.url, startedAt, report)
  } finally {
    running = null
  }
}

function siteReport(startUrl: string, startedAt: string, report: CrawlReport): SiteReport {
  return {
    startUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    stop: STOP[report.stoppedReason],
    pages: report.pages.map((page) => ({
      url: page.url,
      status: page.status,
      title: page.title,
      wordCount: page.wordCount,
      findings: page.findings,
    })),
    findings: report.findings,
    blockedByRobots: report.blockedByRobots.length,
  }
}

export function stopCrawl(): void {
  running?.abort()
}
