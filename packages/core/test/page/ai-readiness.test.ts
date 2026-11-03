import { describe, expect, it } from 'vitest'
import type { AiCrawler, Finding } from '../../src/model'
import { auditPage } from '../../src/page'
import { aiCrawlerAccess } from '../../src/page/checks-geo'
import { OPEN_SITE, fixture, pageAt, robotsBlocking } from './pages'

function byId(findings: readonly Finding[], id: string): Finding {
  const found = findings.find((entry) => entry.checkId === id)
  if (found === undefined) throw new Error(`no finding for ${id}`)
  return found
}

const RENDERED_SHELL = fixture('good.html')

describe('content that needs JavaScript', () => {
  it('fails when the raw HTML holds under a fifth of the words and no schema', async () => {
    const snapshot = await pageAt('https://example.com/', fixture('js-shell-raw.html'), {
      rendered: RENDERED_SHELL,
    })
    const findings = auditPage(snapshot, OPEN_SITE)
    expect(byId(findings, 'ai_content_requires_js')).toMatchObject({
      status: 'fail',
      layer: 'geo',
      severity: 'medium',
      summary: 'The HTML without JavaScript holds 0% of the words.',
    })
    expect(byId(findings, 'schema_requires_js').evidence).toEqual([
      { value: 'Organization' },
      { value: 'ContactPoint' },
      { value: 'WebSite' },
    ])
    expect(byId(findings, 'missing_organization_identity')).toMatchObject({
      status: 'fail',
      severity: 'medium',
      summary: 'The Organization schema appears only after JavaScript runs.',
    })
  })

  it('fails when only the H1 needs JavaScript, though most words are there', async () => {
    const words = 'Grippy trail shoes for muddy hills and rocky ridges. '.repeat(10)
    const raw = `<html><body><p>${words}</p></body></html>`
    const rendered = `<html><body><h1>Trail shoes</h1><p>${words}</p></body></html>`
    const snapshot = await pageAt('https://example.com/trail', raw, { rendered })
    expect(byId(auditPage(snapshot, OPEN_SITE), 'ai_content_requires_js').summary).toBe(
      'The H1 appears only after JavaScript runs.',
    )
  })

  it('has nothing to compare without a rendered page', async () => {
    const snapshot = await pageAt('https://example.com/', fixture('good.html'))
    const findings = auditPage(snapshot, OPEN_SITE)
    for (const id of [
      'ai_content_requires_js',
      'schema_requires_js',
      'schema_properties_missing',
      'webmcp_tool_incomplete',
    ]) {
      expect(byId(findings, id).status).toBe('not_applicable')
    }
  })
})

describe('the home page organization identity', () => {
  const home = (schema: object) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(schema)}</script></head>` +
    '<body></body></html>'

  it.each([
    [{ '@type': 'WebSite', name: 'Acme Running' }, 'fail', 'medium'],
    [{ '@type': 'Corporation', name: 'Other Shoes Inc' }, 'fail', 'critical'],
    [{ '@type': 'https://schema.org/Organization', name: 'Acme Running Co.' }, 'partial', 'low'],
  ])('judges %j as %s (%s)', async (schema, status, severity) => {
    const snapshot = await pageAt('https://example.com/', home(schema))
    expect(byId(auditPage(snapshot, OPEN_SITE), 'missing_organization_identity')).toMatchObject({
      status,
      severity,
    })
  })

  it('checks only the home page', async () => {
    const snapshot = await pageAt('https://example.com/about', home({ '@type': 'WebSite' }))
    const found = byId(auditPage(snapshot, OPEN_SITE), 'missing_organization_identity')
    expect(found.status).toBe('not_applicable')
  })
})

describe('AI crawler access', () => {
  const crawlers: AiCrawler[] = [
    { token: 'TrainBot', operator: 'Example AI', role: 'training' },
    { token: 'SearchBot', operator: 'Example AI', role: 'search_index' },
    { token: 'FetchBot', operator: 'Example AI', role: 'user_fetch' },
  ]
  const url = 'https://example.com/'

  it('passes when only a training crawler is kept out, and notes it as the site choice', () => {
    const found = aiCrawlerAccess(url, robotsBlocking('TrainBot'), crawlers)
    expect(found.status).toBe('pass')
    expect(found.evidence).toEqual([
      { value: 'TrainBot', note: "Example AI, training: kept out by the site's choice" },
    ])
  })

  it('is partial when some answer crawlers are kept out and fails when all are', () => {
    expect(aiCrawlerAccess(url, robotsBlocking('SearchBot'), crawlers)).toMatchObject({
      status: 'partial',
      severity: 'low',
      summary: 'robots.txt blocks 1 of 2 AI search and answer crawlers.',
    })
    const all = aiCrawlerAccess(url, robotsBlocking('SearchBot', 'FetchBot'), crawlers)
    expect(all.status).toBe('fail')
  })

  it('reads the listed AI crawlers when auditing a page', async () => {
    const snapshot = await pageAt('https://example.com/', fixture('good.html'))
    const site = { robots: robotsBlocking('OAI-SearchBot'), brandName: null }
    expect(byId(auditPage(snapshot, site), 'ai_crawler_blocked').status).toBe('partial')
  })
})
