// Pages for the page checks: synthetic fixtures served through the Fetcher seam and parsed with
// linkedom, as the CLI does.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import type { FetchResponse, Fetcher, HtmlParser } from '../../src/io'
import type { PageSnapshot, RobotsPolicy, SiteContext, Vitals } from '../../src/model'
import { fetchPage, withRendered } from '../../src/page'

export const parse: HtmlParser = (html) => parseHTML(html).document as unknown as Document

export function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/pages/${name}`, import.meta.url), 'utf8')
}

export interface Served {
  readonly status?: number
  readonly headers?: Readonly<Record<string, string>>
  readonly rendered?: string
  readonly vitals?: Vitals
}

/** `html` fetched at `url`, with its render and vitals when given. */
export async function pageAt(
  url: string,
  html: string,
  served: Served = {},
): Promise<PageSnapshot> {
  const fetcher: Fetcher = {
    fetch: async (): Promise<FetchResponse> => ({
      url,
      status: served.status ?? 200,
      headers: served.headers ?? {},
      body: html,
    }),
  }
  const snapshot = await fetchPage(fetcher, parse, url)
  return served.rendered === undefined
    ? snapshot
    : withRendered(snapshot, served.rendered, parse, served.vitals ?? null)
}

/** robots.txt as a list of crawler tokens it keeps out of every URL. */
export function robotsBlocking(...tokens: string[]): RobotsPolicy {
  return { allows: (userAgent) => !tokens.includes(userAgent), sitemaps: [] }
}

export const OPEN_SITE: SiteContext = { robots: robotsBlocking(), brandName: 'Acme Running' }
