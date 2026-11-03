import { probeSiteFiles } from '@open-agent-ready/core/site'
import { emit } from '../shared/events'
import type { SiteFiles, SiteReport } from '../shared/results'
import { extensionFetcher } from './fetcher'
import { handle } from './handle'
import { requireHostAccess } from './host-access'
import { idbGet, idbSet } from './idb'
import { offscreen } from './offscreen'

export const LAST_CRAWL = 'crawl'
export const DEFAULT_CRAWL_LIMIT = 200

export async function siteFiles(url: string): Promise<SiteFiles> {
  await requireHostAccess(url)
  const report = await probeSiteFiles(url, extensionFetcher)
  return {
    origin: report.origin,
    facts: report.facts,
    sitemap: report.sitemap,
    findings: report.findings,
    checkedAt: new Date().toISOString(),
  }
}

export async function crawlSite(
  url: string,
  limit: number,
  pinned: readonly string[],
): Promise<SiteReport> {
  await requireHostAccess(url)
  const report = await offscreen('crawl', { url, limit, pinned })
  await idbSet('results', LAST_CRAWL, report)
  emit('crawl:saved', report)
  return report
}

export function lastCrawl(): Promise<SiteReport | undefined> {
  return idbGet<SiteReport>('results', LAST_CRAWL)
}

export function registerSiteHandlers(): void {
  handle('site:files', ({ url }) => siteFiles(url))
  handle('site:crawl', ({ url, limit, pinned }) => crawlSite(url, limit, pinned))
  handle('site:crawl:stop', () => offscreen('crawl:stop', {}))
  handle('site:last', async () => (await lastCrawl()) ?? null)
}
