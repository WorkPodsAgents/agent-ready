import { describe, expect, it } from 'vitest'
import type { Finding } from '../../src'
import { check } from '../../src'
import { fixPrompt, toJson, toMarkdown } from '../../src/report'
import type { SiteReport, PageReport } from '../../src/report'

const URL = 'https://example.com/pricing'

function finding(partial: Partial<Finding> & Pick<Finding, 'checkId' | 'status'>): Finding {
  const isProblem = partial.status === 'fail' || partial.status === 'partial'
  return {
    layer: 'seo',
    group: 'title_meta',
    severity: isProblem ? check(partial.checkId).defaultSeverity : null,
    summary: 'Something was found.',
    evidence: [],
    ...partial,
  }
}

const page: PageReport = {
  kind: 'page',
  url: URL,
  notes: ['Ran without a browser, so rendered checks were not applicable.'],
  findings: [
    finding({ checkId: 'title_too_short', status: 'pass', summary: 'The title is 42 characters.' }),
    finding({
      checkId: 'title_too_long',
      status: 'fail',
      summary: 'The title is 74 characters.',
      evidence: [{ selector: 'head > title', value: 'Acme Running shoes for every runner' }],
    }),
    finding({ checkId: 'missing_title', status: 'fail', summary: 'The page has no title.' }),
    finding({
      checkId: 'llms_txt_invalid',
      layer: 'axo',
      group: 'ai_readiness',
      status: 'not_applicable',
      summary: 'The site has no llms.txt, which is optional.',
    }),
    finding({
      checkId: 'missing_h1',
      group: 'headings_content',
      status: 'fail',
      summary: 'The page has no H1.',
    }),
  ],
}

describe('a page report', () => {
  it('groups by layer then checklist group, worst first, with the rubric line', () => {
    const markdown = toMarkdown(page)

    expect(markdown).toContain('3 failing, 0 partly failing, 1 passing, 1 not applicable.')
    expect(markdown).toContain('> Ran without a browser')
    const order = ['## SEO', '### Title & meta', '`missing_title`', '`title_too_long`']
      .concat(['`title_too_short`', '### Headings & content', '## AXO', '`llms_txt_invalid`'])
      .map((text) => markdown.indexOf(text))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(markdown).toContain(`What high means: ${check('missing_title').rubric.high}`)
    expect(markdown).toContain(
      'Where: element `head > title`, found "Acme Running shoes for every runner"',
    )
  })

  it('exports the same order as JSON, with titles and a null rubric on a pass', () => {
    const json = JSON.parse(toJson(page)) as {
      counts: Record<string, number>
      findings: { checkId: string; title: string; rubric: string | null }[]
    }

    expect(json.counts).toEqual({ fail: 3, partial: 0, pass: 1, not_applicable: 1 })
    expect(json.findings.map((entry) => entry.checkId)).toEqual([
      'missing_title',
      'title_too_long',
      'title_too_short',
      'missing_h1',
      'llms_txt_invalid',
    ])
    expect(json.findings[0]?.title).toBe(check('missing_title').title)
    expect(json.findings[2]?.rubric).toBeNull()
  })
})

describe('a crawl report', () => {
  it('says how many pages it crawled and why it stopped', () => {
    const crawl: SiteReport = {
      kind: 'site',
      url: 'https://example.com/',
      pagesCrawled: 200,
      stopReason: 'reached the 200-page limit',
      notes: [],
      findings: [
        finding({
          checkId: 'broken_internal_link',
          group: 'links',
          status: 'fail',
          summary: '4 internal links point at pages that return 404.',
          evidence: [{ url: 'https://example.com/old-shoes', note: 'linked from 3 pages' }],
        }),
      ],
    }

    const markdown = toMarkdown(crawl)

    expect(markdown).toContain('# Site report: https://example.com/')
    expect(markdown).toContain('Crawled 200 pages (stopped early: reached the 200-page limit).')
    expect(JSON.parse(toJson(crawl))).toMatchObject({ pagesCrawled: 200 })
  })
})

describe('a fix prompt', () => {
  it('says what is wrong, where, what the severity means and how to verify', () => {
    const failing = page.findings[1]
    if (failing === undefined) throw new Error('fixture changed')

    const prompt = fixPrompt(failing, { url: URL, from: 'check' })

    expect(prompt).toContain('Problem: Title longer than 60 characters (check `title_too_long`')
    expect(prompt).toContain('What was found: The title is 74 characters.')
    expect(prompt).toContain('- element `head > title`, found "Acme Running shoes')
    expect(prompt).toContain(check('title_too_long').rubric.low)
    expect(prompt).toContain(`npx -y @workpods/agent-ready check ${URL}`)
  })
})
