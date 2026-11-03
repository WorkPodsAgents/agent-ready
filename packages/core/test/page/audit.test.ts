import { describe, expect, it } from 'vitest'
import { CHECKS } from '../../src'
import type { Finding, Status } from '../../src/model'
import { auditPage, PAGE_CHECKS } from '../../src/page'
import { OPEN_SITE, fixture, pageAt, robotsBlocking } from './pages'

const GOOD_VITALS = { lcpMs: 1800, cls: 0.02 }

function verdicts(findings: readonly Finding[]): Record<string, Status> {
  return Object.fromEntries(findings.map((found) => [found.checkId, found.status]))
}

function byId(findings: readonly Finding[], id: string): Finding {
  const found = findings.find((entry) => entry.checkId === id)
  if (found === undefined) throw new Error(`no finding for ${id}`)
  return found
}

async function audited(url: string, html: string, rendered: string | null = html) {
  const snapshot = await pageAt(
    url,
    html,
    rendered === null ? {} : { rendered, vitals: GOOD_VITALS },
  )
  return auditPage(snapshot, OPEN_SITE)
}

describe('the page check list', () => {
  it('names registry checks in registry order, each with a layer and group', () => {
    const order = [...CHECKS.keys()]
    const indexes = PAGE_CHECKS.map((entry) => order.indexOf(entry.id))
    expect(indexes.every((index) => index >= 0)).toBe(true)
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
  })
})

describe('a well-built page', () => {
  it('passes every check, or has nothing to judge, in registry order', async () => {
    const findings = await audited('https://example.com/', fixture('good.html'))
    expect(findings.map((found) => found.checkId)).toEqual(PAGE_CHECKS.map((entry) => entry.id))
    const failing = findings.filter((found) => found.status !== 'pass')
    expect(failing.map((found) => [found.checkId, found.status, found.summary])).toEqual([])
    expect(findings.every((found) => found.severity === null)).toBe(true)
  })
})

describe('a badly built page', () => {
  it('fires each on-page check it breaks, with the registry severity and evidence', async () => {
    const html = fixture('bad.html')
    const snapshot = await pageAt('https://example.com/shoes/trail', html, {
      rendered: html,
      vitals: { lcpMs: 4600, cls: 0.18 },
    })
    const findings = auditPage(snapshot, { robots: robotsBlocking('Googlebot'), brandName: null })
    expect(verdicts(findings)).toMatchObject({
      title_too_long: 'fail',
      title_too_short: 'pass',
      missing_meta_description: 'fail',
      multiple_h1: 'fail',
      thin_content: 'fail',
      invalid_schema: 'fail',
      schema_properties_missing: 'fail',
      missing_alt_text: 'partial',
      mixed_content: 'fail',
      internal_nofollow: 'fail',
      hreflang_invalid_code: 'fail',
      canonical_mismatch: 'fail',
      noindex: 'fail',
      missing_canonical: 'pass',
      browser_redirect: 'fail',
      blocked_by_robots: 'fail',
      webmcp_tool_incomplete: 'fail',
      controls_unlabelled: 'fail',
      slow_lcp: 'fail',
      poor_cls: 'partial',
      missing_organization_identity: 'not_applicable',
    })
    expect(byId(findings, 'title_too_long')).toMatchObject({
      layer: 'seo',
      group: 'title_meta',
      severity: 'low',
      summary: 'The title is 77 characters, over 60.',
    })
    expect(byId(findings, 'noindex').summary).toBe('The page is noindex by its robots meta tag.')
    expect(byId(findings, 'schema_properties_missing').evidence).toEqual([
      { value: 'Product.offers|review|aggregateRating' },
    ])
    expect(byId(findings, 'hreflang_invalid_code').evidence).toEqual([
      { value: 'en-uk', url: 'https://example.com/uk/shoes/trail' },
    ])
    expect(byId(findings, 'mixed_content').evidence[0]?.url).toBe(
      'http://cdn.example.net/widget.js',
    )
    expect(byId(findings, 'webmcp_tool_incomplete').evidence).toEqual([
      {
        selector: 'html > body:nth-of-type(1) > form:nth-of-type(1)',
        value: 'find_shoe',
        note: 'Lacks a tooldescription and a description for size.',
      },
    ])
    const unnamed = byId(findings, 'controls_unlabelled').evidence.map((entry) => entry.selector)
    expect(unnamed).toEqual([
      'html > body:nth-of-type(1) > a:nth-of-type(2)',
      '#search-go',
      'html > body:nth-of-type(1) > form:nth-of-type(1) > input:nth-of-type(1)',
    ])
  })

  it.each([
    ['missing_title', '<p>Hello</p>', 'fail'],
    ['title_too_long', '<p>Hello</p>', 'not_applicable'],
    ['title_too_short', '<title>Shoes</title>', 'fail'],
    ['title_too_short', '<title>undefined</title>', 'not_applicable'],
    ['missing_h1', '<h2>Only a subheading</h2><noscript><h1>Enable JS</h1></noscript>', 'fail'],
    ['missing_schema', '<p>No JSON-LD</p>', 'fail'],
    ['missing_canonical', '<p>No canonical</p>', 'fail'],
    ['missing_alt_text', '<img src="/a.png"><img data-src="/b.png">', 'fail'],
    ['missing_alt_text', '<img src="/a.png" alt="">', 'pass'],
    ['hreflang_invalid_code', '<p>One language</p>', 'not_applicable'],
  ])('judges %s on %s as %s', async (id, html, status) => {
    const findings = await audited(
      'https://example.com/a',
      `<html><head></head><body>${html}</body></html>`,
      null,
    )
    expect(byId(findings, id).status).toBe(status)
  })
})

describe('forms agents would use (AX2)', () => {
  const page = (body: string) =>
    audited('https://example.com/contact', `<html><head></head><body>${body}</body></html>`)
  const quote =
    '<form><input name="email" type="email"><textarea name="message"></textarea>' +
    '<button>Send</button></form>'

  it.each([
    ['a contact form no tool exposes', quote, 'fail', 'medium'],
    ['only a newsletter box', '<form><input name="email" type="email"></form>', 'fail', 'low'],
    ['a search box', '<form role="search"><input name="q"></form>', 'fail', 'medium'],
    [
      'a form declared as a tool',
      quote.replace('<form>', '<form toolname="contact">'),
      'pass',
      null,
    ],
    [
      'only a sign-in form',
      '<form><input name="u"><input type="password" name="p"></form>',
      'not_applicable',
      null,
    ],
    ['no form', '<p>Call us.</p>', 'not_applicable', null],
  ])('judges %s', async (_, body, status, severity) => {
    const found = byId(await page(body), 'AX2')
    expect([found.layer, found.status, found.severity]).toEqual(['axo', status, severity])
  })
})

describe('what the response says', () => {
  it('reads noindex and an hreflang alternate from the headers', async () => {
    const snapshot = await pageAt('https://example.com/a', '<title>A page</title>', {
      headers: {
        'X-Robots-Tag': 'bingbot: none, googlebot: noindex',
        link: '<https://example.com/b>; rel="alternate"; hreflang="en-XX"',
      },
    })
    const findings = auditPage(snapshot, OPEN_SITE)
    expect(byId(findings, 'noindex').summary).toBe(
      'The page is noindex by its X-Robots-Tag header.',
    )
    expect(byId(findings, 'hreflang_invalid_code').status).toBe('fail')
  })

  it('ignores an X-Robots-Tag aimed at another crawler', async () => {
    const snapshot = await pageAt('https://example.com/a', '<title>A page</title>', {
      headers: { 'x-robots-tag': 'bingbot: noindex' },
    })
    expect(byId(auditPage(snapshot, OPEN_SITE), 'noindex').status).toBe('pass')
  })

  it('judges no content on a page that answered 404', async () => {
    const findings = auditPage(
      await pageAt('https://example.com/gone', '', { status: 404 }),
      OPEN_SITE,
    )
    expect(byId(findings, 'non_200_status')).toMatchObject({ status: 'fail', severity: 'high' })
    const content = findings.filter(
      (found) =>
        ![
          'non_200_status',
          'redirect_chain',
          'redirect_loop',
          'blocked_by_robots',
          'ai_crawler_blocked',
          'slow_lcp',
          'poor_cls',
        ].includes(found.checkId),
    )
    expect(new Set(content.map((found) => found.status))).toEqual(new Set(['not_applicable']))
  })

  it('leaves the status unknown when the site refused the request', async () => {
    const findings = auditPage(
      await pageAt('https://example.com/a', '', { status: 403 }),
      OPEN_SITE,
    )
    expect(byId(findings, 'non_200_status').status).toBe('not_applicable')
  })

  it('has no robots verdicts or vitals when robots.txt and the browser were not read', async () => {
    const snapshot = await pageAt('https://example.com/a', '<title>A page</title>')
    const findings = auditPage(snapshot, { robots: null, brandName: null })
    expect(verdicts(findings)).toMatchObject({
      blocked_by_robots: 'not_applicable',
      ai_crawler_blocked: 'not_applicable',
      slow_lcp: 'not_applicable',
      poor_cls: 'not_applicable',
    })
  })
})
