// Reads a Google results page the user has open: the free keyword data (People Also Ask, related
// searches) and the top ten organic results. Hooks prefer data attributes and visible headings,
// which outlast Google's generated class names.
import { cleanUrl, firstOf, sectionHeadedBy } from '../engines/extract'

export interface OrganicResult {
  /** 1-based, counting organic results only. */
  readonly position: number
  readonly url: string
  readonly title: string
}

export interface SerpReading {
  readonly query: string | null
  readonly organic: readonly OrganicResult[]
  readonly peopleAlsoAsk: readonly string[]
  readonly relatedSearches: readonly string[]
  /** True when the page shows an AI Overview above the results. */
  readonly aiOverview: boolean
}

const ORGANIC_LIMIT = 10
const RESULTS = ['#rso', '#search', '[role="main"]']
// Ads, the PAA accordion and the AI Overview hold links with headings that are not results.
const NOT_ORGANIC =
  '#tads, #bottomads, [data-text-ad], .related-question-pair, [data-q], [data-subtree="aio"]'
const PAA = /^People also ask$/i
const RELATED = /^(Related searches|People also search for)$/i
const AI_OVERVIEW = /^AI Overview$/i

export function readSerp(doc: Document, pageUrl: string): SerpReading {
  return {
    query: new URL(pageUrl).searchParams.get('q'),
    organic: organic(doc, pageUrl),
    peopleAlsoAsk: peopleAlsoAsk(doc),
    relatedSearches: related(doc),
    aiOverview:
      doc.querySelector('[data-subtree="aio"]') !== null ||
      sectionHeadedBy(doc, AI_OVERVIEW) !== null,
  }
}

function organic(doc: Document, pageUrl: string): OrganicResult[] {
  const root = firstOf(doc, RESULTS) ?? doc.body
  const results: OrganicResult[] = []
  const seen = new Set<string>()
  for (const heading of Array.from(root.querySelectorAll('a h3'))) {
    const link = heading.closest('a')
    if (link === null || link.closest(NOT_ORGANIC) !== null) continue
    const url = cleanUrl(link.getAttribute('href') ?? '', pageUrl)
    if (url === null || seen.has(url) || isGoogle(url)) continue
    seen.add(url)
    results.push({ position: results.length + 1, url, title: squash(heading.textContent) })
    if (results.length === ORGANIC_LIMIT) break
  }
  return results
}

function peopleAlsoAsk(doc: Document): string[] {
  const tagged = Array.from(doc.querySelectorAll('[data-q]'))
    .map((el) => squash(el.getAttribute('data-q')))
    .filter((q) => q.length > 0)
  if (tagged.length > 0) return unique(tagged)
  const section = sectionHeadedBy(doc, PAA)
  if (section === null) return []
  return unique(
    Array.from(section.querySelectorAll('[role="button"], [aria-expanded]'))
      .map((el) => squash(el.textContent))
      .filter((q) => q.endsWith('?')),
  )
}

function related(doc: Document): string[] {
  const section = sectionHeadedBy(doc, RELATED) ?? doc.querySelector('#bres')
  if (section === null) return []
  return unique(
    Array.from(section.querySelectorAll('a[href*="/search?"]'))
      .map((a) => squash(a.textContent))
      .filter((text) => text.length > 0),
  )
}

function isGoogle(url: string): boolean {
  return /(^|\.)google\.[a-z.]+$/.test(new URL(url).hostname)
}

function squash(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}
