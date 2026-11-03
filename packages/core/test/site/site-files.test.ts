import { describe, expect, it } from 'vitest'
import { probeSiteFiles } from '../../src/site'
import { fakeSite } from './fake-site'

const O = 'https://example.com'
const HTML = { headers: { 'content-type': 'text/html' }, body: '<!doctype html><p>Not found</p>' }
const JSON_TYPE = { 'content-type': 'application/json' }

describe('the site files probe', () => {
  it('reports crawler verdicts, sitemap URLs and passing files for a good site', async () => {
    const site = fakeSite({
      [`${O}/robots.txt`]: {
        body: [
          'User-agent: GPTBot',
          'Disallow: /',
          'User-agent: *',
          'Content-Signal: search=yes, ai-train=no',
          'Allow: /',
          `Sitemap: ${O}/sitemap.xml`,
        ].join('\n'),
      },
      [`${O}/sitemap.xml`]: { body: `<urlset><url><loc>${O}/a</loc></url></urlset>` },
      [`${O}/`]: {
        headers: {
          'content-type': 'text/html',
          link: '</index.md>; rel="alternate"; type="text/markdown"',
        },
      },
      [`${O}/index.md`]: {
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
        body: '# Acme',
      },
      [`${O}/llms.txt`]: { headers: { 'content-type': 'text/plain' }, body: '# Acme Running\n' },
      [`${O}/.well-known/ai-catalog.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({ specVersion: '1.0', entries: [] }),
      },
    })
    const report = await probeSiteFiles(`${O}/some/page`, site)
    expect(report.origin).toBe(O)
    expect(report.sitemap.urls).toEqual([`${O}/a`])
    expect(report.facts.aiCrawlers.find((c) => c.token === 'GPTBot')?.allowed).toBe(false)
    expect(report.facts.aiCrawlers.find((c) => c.token === 'ClaudeBot')?.allowed).toBe(true)
    expect(report.facts.contentSignals.map((s) => `${s.signal}=${s.value}`)).toEqual([
      'search=yes',
      'ai-train=no',
    ])
    expect(report.facts.markdown).toEqual({
      url: `${O}/`,
      servedOnAccept: false,
      alternate: `${O}/index.md`,
      alternateServed: true,
    })
    expect(report.findings.map((f) => [f.checkId, f.status, f.severity])).toEqual([
      ['llms_txt_invalid', 'pass', null],
      ['agent_manifest_invalid', 'pass', null],
    ])
  })

  it('treats HTML stand-ins and 404s as absent files, never as broken ones', async () => {
    const site = fakeSite({
      [`${O}/llms.txt`]: HTML,
      [`${O}/.well-known/ai-catalog.json`]: { status: 301, headers: { location: '/' } },
      [`${O}/`]: { headers: { 'content-type': 'text/html' }, body: '<html></html>' },
      [`${O}/.well-known/agent-card.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({ error: 'Not Found' }),
      },
    })
    const report = await probeSiteFiles(O, site)
    const kinds = report.facts.agentFiles.map((f) => [f.kind, f.outcome, f.absence])
    expect(kinds).toEqual([
      ['llms_txt', 'not_found', 'html_answer'],
      ['ai_catalog', 'not_found', 'html_answer'],
      ['a2a_agent_card', 'not_found', 'not_found_json'],
      ['a2a_agent_card', 'not_found', null],
      ['ai_plugin', 'not_found', null],
    ])
    expect(report.findings.map((f) => f.status)).toEqual(['not_applicable', 'not_applicable'])
    expect(report.robots.allows('GPTBot', '/')).toBe(true)
  })

  it('fails a broken llms.txt, a dangling catalog card and a legacy-only site', async () => {
    const broken = fakeSite({
      [`${O}/llms.txt`]: { body: 'Acme Running sells shoes.\n' },
      [`${O}/.well-known/ai-catalog.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({
          specVersion: '1.0',
          entries: [
            {
              identifier: 's',
              type: 'application/mcp-server-card+json',
              url: '/missing-card.json',
            },
          ],
        }),
      },
    })
    const report = await probeSiteFiles(O, broken)
    const [llms, manifest] = report.findings
    expect(llms).toMatchObject({ status: 'fail', severity: 'low', layer: 'geo' })
    expect(manifest).toMatchObject({ status: 'fail', severity: 'medium', layer: 'axo' })
    expect(manifest?.summary).toBe('The AI catalog links to an MCP server card that is not there.')

    const legacy = fakeSite({
      [`${O}/.well-known/ai-plugin.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({ schema_version: 'v1', name_for_model: 'acme' }),
      },
    })
    const old = await probeSiteFiles(O, legacy)
    expect(old.findings[1]?.summary).toBe(
      'The only agent manifest on the site is the retired ai-plugin.json.',
    )
  })
})
