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
      [`${O}/.well-known/api-catalog`]: { headers: { 'content-type': 'text/plain' }, body: 'Nope' },
    })
    const report = await probeSiteFiles(O, site)
    const kinds = report.facts.agentFiles.map((f) => [f.kind, f.outcome, f.absence])
    expect(kinds).toEqual([
      ['llms_txt', 'not_found', 'html_answer'],
      ['ai_catalog', 'not_found', 'html_answer'],
      ['mcp_server_card', 'not_found', null],
      ['a2a_agent_card', 'not_found', 'not_found_json'],
      ['a2a_agent_card', 'not_found', null],
      ['ai_plugin', 'not_found', null],
      ['api_catalog', 'not_found', 'not_json_answer'],
      ['agent_skills_index', 'not_found', null],
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

describe('the agent discovery files', () => {
  const SERVER_CARD = {
    $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
    name: 'com.example/store',
    version: '1.0.0',
    description: 'Order running shoes from Acme Running.',
    remotes: [{ type: 'streamable-http', url: `${O}/mcp` }],
  }
  const LINKSET = { 'content-type': 'application/linkset+json' }
  const SKILLS = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
  const PRM = `${O}/.well-known/oauth-protected-resource`

  it('passes the well-known MCP card, API catalog, skills index and sign-in metadata', async () => {
    const site = fakeSite({
      [`${O}/.well-known/ai-catalog.json`]: {
        headers: { 'content-type': 'application/ai-catalog+json' },
        body: JSON.stringify({
          specVersion: '0.9',
          entries: [{ identifier: 'urn:air:example.com:store', type: 'x/y', url: '/a' }],
        }),
      },
      [`${O}/.well-known/mcp/server-card.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify(SERVER_CARD),
      },
      [`${O}/.well-known/api-catalog`]: {
        headers: LINKSET,
        body: JSON.stringify({ linkset: [{ item: [{ href: `${O}/api` }] }] }),
      },
      [`${O}/.well-known/agent-skills/index.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({ $schema: SKILLS, skills: [] }),
      },
      [`${PRM}/mcp`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({ resource: `${O}/mcp`, authorization_servers: [`${O}/auth`] }),
      },
    })
    const report = await probeSiteFiles(O, site)
    const read = report.facts.agentFiles.filter((f) => f.outcome === 'ok')
    expect(read.map((f) => [f.kind, f.problems])).toEqual([
      ['ai_catalog', []],
      ['mcp_server_card', []],
      ['api_catalog', []],
      ['agent_skills_index', []],
      ['oauth_protected_resource', []],
    ])
    const manifest = report.findings[1]
    expect(manifest).toMatchObject({ status: 'pass', severity: null })
    expect(manifest?.summary).toBe(
      '5 agent manifests meet their standard. 1 AI catalog entry lacks the displayName ARD ' +
        'v0.91 requires; the AI Catalog spec leaves it optional.',
    )
    expect(site.requests.map((r) => r.url)).not.toContain(PRM)
  })

  it('reads sign-in metadata only for an MCP endpoint on the site, at its root as a fallback', async () => {
    const elsewhere = fakeSite({
      [`${O}/.well-known/mcp/server-card.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({
          ...SERVER_CARD,
          remotes: [{ type: 'streamable-http', url: 'https://mcp.example.net/mcp' }],
        }),
      },
    })
    const away = await probeSiteFiles(O, elsewhere)
    expect(away.facts.agentFiles.map((f) => f.kind)).not.toContain('oauth_protected_resource')
    expect(away.findings[1]?.status).toBe('pass')

    const broken = fakeSite({
      [`${O}/.well-known/mcp/server-card.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify(SERVER_CARD),
      },
      [PRM]: {
        headers: JSON_TYPE,
        body: JSON.stringify({ resource: 'https://other.example/', authorization_servers: [] }),
      },
    })
    const report = await probeSiteFiles(O, broken)
    const metadata = report.facts.agentFiles.filter((f) => f.kind === 'oauth_protected_resource')
    expect(metadata.map((f) => [f.url, f.outcome])).toEqual([
      [`${PRM}/mcp`, 'not_found'],
      [PRM, 'ok'],
    ])
    expect(report.findings[1]).toMatchObject({ status: 'fail', severity: 'medium' })
    expect(report.findings[1]?.evidence).toEqual([
      { url: PRM, note: 'invalid_field: resource; missing_field: authorization_servers' },
    ])
  })

  it('shows emerging standards as found or not, never as a finding', async () => {
    const site = fakeSite({
      [`${O}/.well-known/search?q=about`]: {
        headers: { 'content-type': 'text/markdown; charset=utf-8', 'accept-query': 'text/plain' },
        body: '# Search results for: "about"\n',
      },
      [`${O}/auth.md`]: { headers: { 'content-type': 'text/markdown' }, body: '# Acme auth.md\n' },
      [`${O}/.well-known/poppy.json`]: {
        headers: JSON_TYPE,
        body: JSON.stringify({
          protocol_version: '1.0',
          organization: { name: 'Acme', domain: 'other.example' },
        }),
      },
    })
    const report = await probeSiteFiles(O, site)
    expect(report.facts.emerging.map((s) => [s.standard, s.status])).toEqual([
      ['search_for_agents', 'found'],
      ['auth_md', 'found'],
      ['poppy', 'absent'],
    ])
    expect(report.findings.map((f) => [f.checkId, f.status])).toEqual([
      ['llms_txt_invalid', 'not_applicable'],
      ['agent_manifest_invalid', 'not_applicable'],
    ])
  })
})
