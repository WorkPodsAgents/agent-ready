// The one file that calls the page lane's entry points, so a change to their signatures touches
// only this file.
import { auditPage, fetchPage, withRendered } from '@open-agent-ready/core/page'
import { robotsFromAnswer } from '@open-agent-ready/core/site'
import type { PageSnapshot } from '@open-agent-ready/core'
import type { AgentView, RenderedPage } from '../shared/offscreen'
import type { PageAudit } from '../shared/results'
import { aiView } from './ai-view'
import { parseHtml, relayFetcher } from './fetcher'

/** The most HTML of each version a tool result carries. */
export const HTML_LIMIT = 200_000

/** Site-wide facts the page checks use; core does not export the type by name. */
type SiteContext = Parameters<typeof auditPage>[1]

export async function audit(
  url: string,
  rendered: RenderedPage | null,
  brandName: string | null,
): Promise<PageAudit> {
  const snapshot = await snapshotOf(url, rendered)
  return auditOf(snapshot, { robots: await robotsFor(snapshot.url), brandName })
}

export async function seeAsAgent(url: string, rendered: RenderedPage | null): Promise<AgentView> {
  const snapshot = await snapshotOf(url, rendered)
  const renderedHtml = rendered?.html ?? null
  return {
    url: snapshot.url,
    status: snapshot.status,
    rawHtml: snapshot.rawHtml.slice(0, HTML_LIMIT),
    renderedHtml: renderedHtml?.slice(0, HTML_LIMIT) ?? null,
    truncated: snapshot.rawHtml.length > HTML_LIMIT || (renderedHtml?.length ?? 0) > HTML_LIMIT,
    audit: auditOf(snapshot, { robots: await robotsFor(snapshot.url), brandName: null }),
  }
}

async function snapshotOf(url: string, rendered: RenderedPage | null): Promise<PageSnapshot> {
  const fetched = await fetchPage(relayFetcher, parseHtml, url)
  return rendered === null
    ? fetched
    : withRendered(fetched, rendered.html, parseHtml, rendered.vitals)
}

function auditOf(snapshot: PageSnapshot, site: SiteContext): PageAudit {
  return {
    url: snapshot.url,
    status: snapshot.status,
    findings: auditPage(snapshot, site),
    view: aiView(snapshot),
    vitals: snapshot.vitals,
    auditedAt: new Date().toISOString(),
  }
}

// Crawlers follow a few robots.txt redirects (http to https, apex to www) before they give up.
const ROBOTS_HOPS = 5

async function robotsFor(url: string): Promise<SiteContext['robots']> {
  let target = new URL('/robots.txt', url).href
  for (let hop = 0; hop <= ROBOTS_HOPS; hop++) {
    const answer = await relayFetcher.fetch({ url: target, accept: 'text/plain' }).catch(() => null)
    const location = answer?.headers['location']
    if (answer === null || location === undefined || answer.status < 300 || answer.status > 399) {
      return robotsFromAnswer(answer?.status ?? null, answer?.body ?? '')
    }
    target = new URL(location, target).href
  }
  return robotsFromAnswer(null, '')
}
