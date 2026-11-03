import { describe, expect, it } from 'vitest'
import { crawlSite, type CrawlOptions, type ReadPage } from '../../src/crawl'
import type { PageFacts, PageLink, RedirectHop } from '../../src/model'
import { fakeSite } from '../site/fake-site'

const O = 'https://example.com'

interface Spec {
  readonly status?: number
  readonly title?: string
  readonly description?: string
  readonly text?: string
  readonly canonical?: string
  readonly noindex?: boolean
  readonly links?: readonly string[]
  readonly hreflang?: Readonly<Record<string, string>>
  readonly redirect?: string
}

/** A site of pages by path; reading a page follows its redirects as fetchPage would. */
function pageReader(site: Readonly<Record<string, Spec>>, read: string[] = []): ReadPage {
  return async (url) => {
    read.push(url)
    const redirects: RedirectHop[] = []
    let current = url
    let spec = site[new URL(current).pathname]
    while (spec?.redirect !== undefined) {
      const location = `${O}${spec.redirect}`
      redirects.push({ url: current, status: 301, location })
      current = location
      spec = site[new URL(current).pathname]
    }
    const page = spec ?? { status: 404 }
    const link = (path: string): PageLink => ({
      url: `${O}${path}`,
      rel: [],
      text: '',
      internal: true,
    })
    const facts: PageFacts = {
      url: current,
      status: page.status ?? 200,
      redirects,
      contentType: 'text/html',
      title: page.title ?? new URL(current).pathname,
      metaDescription: page.description ?? null,
      h1s: [],
      canonical: page.canonical === undefined ? null : `${O}${page.canonical}`,
      noindex: page.noindex ?? false,
      links: (page.links ?? []).map(link),
      hreflang: Object.entries(page.hreflang ?? {}).map(([lang, path]) => ({
        lang,
        url: `${O}${path}`,
      })),
      wordCount: 300,
      textHash: page.text ?? `text of ${new URL(current).pathname}`,
    }
    return { facts, findings: [] }
  }
}

const SITE: Record<string, Spec> = {
  '/': {
    title: 'Acme Running',
    links: ['/a', '/b', '/old', '/missing', '/deep1', '/private', '/soft'],
  },
  '/a': {
    title: 'Running shoes',
    description: 'Buy running shoes',
    text: 'shoes',
    links: ['/'],
    hreflang: { en: '/a', de: '/de/a' },
  },
  '/de/a': { title: 'Laufschuhe', hreflang: { de: '/de/a' } },
  '/b': { title: 'Running Shoes ', description: 'Buy running shoes', text: 'shoes' },
  '/old': { redirect: '/a' },
  '/deep1': { links: ['/deep2'] },
  '/deep2': { links: ['/deep3'] },
  '/deep3': { links: ['/deep4'] },
  '/deep4': {},
  '/soft': { canonical: '/' },
  '/orphan': {},
  '/hidden': { noindex: true },
}

const SITEMAP = [
  '/',
  '/b',
  '/de/a',
  '/deep1',
  '/deep2',
  '/deep3',
  '/deep4',
  '/soft',
  '/orphan',
  '/hidden',
  '/gone',
]

// The made-up URL the crawl asks for is random, so this site answers it 404 like any unknown URL.
function files() {
  return fakeSite({
    [`${O}/robots.txt`]: {
      body: `User-agent: OpenAgentReady\nDisallow: /private\nSitemap: ${O}/sitemap.xml`,
    },
    [`${O}/sitemap.xml`]: {
      body: `<urlset>${SITEMAP.map((p) => `<url><loc>${O}${p}</loc></url>`).join('')}</urlset>`,
    },
  })
}

function options(overrides: Partial<CrawlOptions> = {}): CrawlOptions & { slept: number[] } {
  const slept: number[] = []
  return {
    start: `${O}/`,
    pinned: [],
    fetcher: files(),
    parse: () => {
      throw new Error('the fake reader never parses')
    },
    sleep: async (ms) => {
      slept.push(ms)
    },
    signal: new AbortController().signal,
    onProgress: () => {},
    readPage: pageReader(SITE),
    slept,
    ...overrides,
  }
}

const verdicts = (findings: readonly { checkId: string; status: string }[]) =>
  Object.fromEntries(findings.map((f) => [f.checkId, f.status]))

describe('crawling a site', () => {
  it('finds the cross-page problems of a small site', async () => {
    const report = await crawlSite(options())
    expect(report.stoppedReason).toBe('done')
    expect(report.blockedByRobots).toEqual([`${O}/private`])
    expect(verdicts(report.findings)).toEqual({
      duplicate_title: 'partial',
      duplicate_meta_description: 'fail',
      duplicate_content: 'partial',
      orphan_page: 'partial',
      deep_page: 'partial',
      broken_internal_link: 'partial',
      internal_link_to_redirect: 'partial',
      sitemap_url_error: 'partial',
      sitemap_non_indexable: 'partial',
      missing_from_sitemap: 'partial',
      hreflang_missing_return: 'fail',
      hreflang_target_not_200: 'pass',
      soft_404: 'partial',
    })
    const page = (path: string) => report.pages.find((p) => p.url === `${O}${path}`)
    const fired = (path: string) => page(path)?.findings.map((f) => f.checkId)
    expect(fired('/')).toEqual(['broken_internal_link', 'internal_link_to_redirect'])
    expect(fired('/a')).toEqual([
      'duplicate_title',
      'duplicate_meta_description',
      'duplicate_content',
      'missing_from_sitemap',
      'hreflang_missing_return',
    ])
    expect(fired('/orphan')).toEqual(['orphan_page'])
    expect(fired('/hidden')).toEqual(['orphan_page', 'sitemap_non_indexable'])
    expect(fired('/deep4')).toEqual(['deep_page'])
    expect(fired('/soft')).toEqual(['sitemap_non_indexable', 'soft_404'])
    expect(fired('/gone')).toEqual(['sitemap_url_error'])
    expect(page('/deep4')).toMatchObject({ depth: 4, inlinks: 1 })
    expect(page('/a')).toMatchObject({ depth: 1, inlinks: 1 })
    expect(report.pages.filter((p) => p.url === `${O}/a`)).toHaveLength(1)
    const summary = report.findings.find((f) => f.checkId === 'orphan_page')?.summary
    expect(summary).toBe('3 of 10 pages checked have no internal link from another crawled page.')
    expect(report.notFoundProbe?.status).toBe(404)
  })

  it('waits between requests and stops at the page limit', async () => {
    const run = options({ limit: 2, delayMs: 250 })
    const progress: number[] = []
    const report = await crawlSite({ ...run, onProgress: (done) => progress.push(done) })
    expect(report.stoppedReason).toBe('limit')
    expect(report.pages.map((p) => p.url)).toEqual([`${O}/`, `${O}/a`])
    expect(progress).toEqual([1, 2])
    // One pause between the two pages and one before the made-up URL.
    expect(run.slept).toEqual([250, 250])
    const orphan = report.findings.find((f) => f.checkId === 'orphan_page')
    expect(orphan?.status).toBe('not_applicable')
  })

  it('crawls pinned pages early and stops when aborted', async () => {
    const controller = new AbortController()
    const read: string[] = []
    const report = await crawlSite(
      options({
        pinned: [`${O}/orphan`],
        signal: controller.signal,
        readPage: pageReader(SITE, read),
        onProgress: (done) => {
          if (done === 2) controller.abort()
        },
      }),
    )
    expect(read).toEqual([`${O}/`, `${O}/orphan`])
    expect(report.stoppedReason).toBe('aborted')
    expect(report.notFoundProbe).toBeNull()
  })

  it('fails soft_404 when a made-up URL answers 200', async () => {
    const always = {
      fetch: async (r: { url: string }) => ({ url: r.url, status: 200, headers: {}, body: '' }),
    }
    const report = await crawlSite(options({ fetcher: always, readPage: pageReader({ '/': {} }) }))
    const soft = report.findings.find((f) => f.checkId === 'soft_404')
    expect(soft?.status).toBe('fail')
    expect(soft?.summary).toBe('A made-up URL answered 200 instead of 404.')
  })
})
