import type { PageAudit, PageComparison } from '../shared/results'
import { activeTab, highlight, renderedPage } from './active-tab'
import { handle } from './handle'
import { requireHostAccess } from './host-access'
import { idbGet, idbSet } from './idb'
import { offscreen } from './offscreen'
import { readSettings } from './settings'
import { sameDocument } from '../shared/host'

export const LAST_PAGE = 'page'
export const LAST_COMPARE = 'compare'

/**
 * Audits a URL. When it is the page open in the active tab, the live DOM and vitals come along;
 * otherwise only the raw HTML is checked and the checks that need a browser are not applicable.
 */
export async function auditUrl(url: string, brandName: string | null): Promise<PageAudit> {
  await requireHostAccess(url)
  const tab = await activeTab().catch(() => null)
  const rendered = tab !== null && sameDocument(tab.url, url) ? await renderedPage(tab.id) : null
  return offscreen('audit', { url, rendered, brandName })
}

export async function seeAsAgent(url: string) {
  await requireHostAccess(url)
  const tab = await activeTab().catch(() => null)
  const rendered = tab !== null && sameDocument(tab.url, url) ? await renderedPage(tab.id) : null
  return offscreen('see', { url, rendered })
}

export async function comparePages(url: string, competitorUrl: string): Promise<PageComparison> {
  const brandName = (await readSettings()).brandName
  // One page at a time, so two sites are never fetched at once from the user's connection.
  const mine = await auditUrl(url, brandName)
  const theirs = await auditUrl(competitorUrl, null)
  const side = (audit: PageAudit) => ({
    url: audit.url,
    status: audit.status,
    view: audit.view,
    findings: audit.findings,
  })
  const comparison = { mine: side(mine), theirs: side(theirs) }
  await idbSet('results', LAST_COMPARE, comparison)
  return comparison
}

export function registerPageHandlers(): void {
  handle('page:audit', async ({ brandName }) => {
    const tab = await activeTab()
    const audit = await auditUrl(tab.url, brandName ?? (await readSettings()).brandName)
    await idbSet('results', LAST_PAGE, audit)
    return audit
  })
  handle('page:last', async () => (await idbGet<PageAudit>('results', LAST_PAGE)) ?? null)
  handle('page:highlight', async ({ selector }) => {
    const tab = await activeTab()
    if (!(await highlight(tab.id, selector))) throw new Error('That element is not on the page.')
    return null
  })
  handle('compare', ({ url, competitorUrl }) => comparePages(url, competitorUrl))
  handle(
    'compare:last',
    async () => (await idbGet<PageComparison>('results', LAST_COMPARE)) ?? null,
  )
}
