import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkAgentCard,
  checkApiCatalog,
  checkCatalog,
  checkProtectedResource,
  checkServerCard,
  checkSkillsIndex,
  llmsTxtProblems,
} from '../../src/site'

/**
 * Recorded documents: the AI Catalog v0.9 RC example (Agent-Card/ai-catalog 08692c4
 * specification/examples/ai-catalog.json), workpods.ai's catalog as served on 2026-11-26, the
 * RFC 9727 appendix A.2 API catalog, and the first three skills of isitagentready.com's agent
 * skills index as served on 2026-11-26.
 */
function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/site/${name}`, import.meta.url), 'utf8')
}

const SERVER_CARD = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'com.example/store',
  version: '1.0.0',
  description: 'Order running shoes from Acme Running.',
  remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }],
}

describe('llms.txt', () => {
  it('passes a file that opens with an H1 after front matter or a comment', () => {
    expect(llmsTxtProblems('# Acme Running\n\n> Shoes.')).toEqual([])
    expect(llmsTxtProblems('---\ntitle: x\n---\n\n<!-- hi -->\nAcme Running\n====\n')).toEqual([])
  })

  it('flags a file with no opening H1', () => {
    expect(llmsTxtProblems('## Docs\n- [a](https://example.com/a)')).toEqual([
      { code: 'missing_h1', field: null },
    ])
    expect(llmsTxtProblems('    # indented four spaces is code')).toHaveLength(1)
  })
})

describe('agent manifests', () => {
  it('accepts a catalog and returns the server cards it links to', () => {
    const catalog = checkCatalog(
      JSON.stringify({
        specVersion: '1.0',
        entries: [
          { identifier: 'store', type: 'application/mcp-server-card+json', url: '/mcp-card.json' },
          { identifier: 'inline', type: 'application/mcp-server-card+json', data: SERVER_CARD },
        ],
      }),
    )
    expect(catalog).toEqual({
      problems: [],
      ard: [
        { code: 'missing_field', field: 'entries[0].displayName' },
        { code: 'missing_field', field: 'entries[1].displayName' },
      ],
      cards: ['/mcp-card.json'],
      remotes: ['https://example.com/mcp'],
    })
  })

  it('meets the AI Catalog v0.9 RC and names the displayNames only ARD v0.91 requires', () => {
    const spec = checkCatalog(fixture('ai-catalog-0.9.json'))
    expect(spec.problems).toEqual([])
    expect(spec.ard).toEqual([{ code: 'missing_field', field: 'entries[0].displayName' }])
    const workpods = checkCatalog(fixture('workpods-ai-catalog.json'))
    expect(workpods.problems).toEqual([])
    expect(workpods.ard).toEqual([{ code: 'missing_field', field: 'entries[0].displayName' }])
    expect(workpods.cards).toEqual(['https://mcp.workpods.ai/mcp/server-card'])
    const host = JSON.stringify({ specVersion: '0.9', host: { identifier: 'x' }, entries: [] })
    expect(checkCatalog(host).problems).toEqual([
      { code: 'missing_field', field: 'host.displayName' },
    ])
  })

  it('names each field a catalog, server card or agent card gets wrong', () => {
    expect(
      checkCatalog(JSON.stringify({ specVersion: 'v1', entries: [{ type: 'x' }] })).problems,
    ).toEqual([
      { code: 'invalid_field', field: 'specVersion' },
      { code: 'missing_field', field: 'entries[0].identifier' },
      { code: 'invalid_field', field: 'entries[0].url' },
    ])
    expect(
      checkServerCard(JSON.stringify({ ...SERVER_CARD, name: 'store', remotes: [{ type: 'ws' }] })),
    ).toEqual([
      { code: 'invalid_field', field: 'name' },
      { code: 'invalid_field', field: 'remotes[0].type' },
      { code: 'missing_field', field: 'remotes[0].url' },
    ])
    expect(checkServerCard('not json')).toEqual([{ code: 'not_json', field: null }])
  })

  it('accepts a 0.x agent card url only on the legacy path', () => {
    const card = {
      name: 'Acme',
      description: 'Shoes',
      version: '0.3',
      capabilities: {},
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      url: 'https://example.com/a2a',
      skills: [{ id: 'order', name: 'Order', description: 'Orders shoes', tags: ['shop'] }],
    }
    expect(checkAgentCard(JSON.stringify(card), true)).toEqual([])
    expect(checkAgentCard(JSON.stringify(card), false)).toEqual([
      { code: 'missing_field', field: 'supportedInterfaces' },
    ])
  })
})

describe('discovery documents', () => {
  it('accepts the RFC 9727 API catalog only as a linkset with links', () => {
    const catalog = fixture('api-catalog-rfc9727.json')
    expect(checkApiCatalog(catalog, 'application/linkset+json')).toEqual([])
    expect(checkApiCatalog(catalog, 'application/json')).toEqual([
      { code: 'invalid_media_type', field: null },
    ])
    const broken = JSON.stringify({ linkset: [{ anchor: 1, item: [{ title: 'x' }], up: 'x' }] })
    expect(checkApiCatalog(broken, 'application/linkset+json')).toEqual([
      { code: 'invalid_field', field: 'linkset[0].anchor' },
      { code: 'missing_field', field: 'linkset[0].item[0].href' },
      { code: 'invalid_field', field: 'linkset[0].up' },
      { code: 'missing_field', field: 'linkset' },
    ])
  })

  it('checks an agent skills index against v0.2.0 without fetching its skills', () => {
    expect(checkSkillsIndex(fixture('agent-skills-index.json'))).toEqual([])
    const skill = {
      name: '-Review',
      type: 'zip',
      description: 'Reviews code.',
      url: '/s/SKILL.md',
      digest: 'sha256:ABC',
    }
    const index = {
      $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
      skills: [skill],
    }
    expect(checkSkillsIndex(JSON.stringify(index))).toEqual([
      { code: 'invalid_field', field: 'skills[0].name' },
      { code: 'invalid_field', field: 'skills[0].type' },
      { code: 'invalid_field', field: 'skills[0].digest' },
    ])
    expect(checkSkillsIndex(JSON.stringify({ skills: [skill] }))).toContainEqual({
      code: 'missing_field',
      field: '$schema',
    })
  })

  it('wants protected resource metadata to name its resource and an authorization server', () => {
    const resource = 'https://example.com/mcp'
    const good = { resource, authorization_servers: ['https://auth.example.com'] }
    expect(checkProtectedResource(JSON.stringify(good), [resource])).toEqual([])
    const wrong = { resource: 'https://other.example/mcp', authorization_servers: [] }
    expect(checkProtectedResource(JSON.stringify(wrong), [resource])).toEqual([
      { code: 'invalid_field', field: 'resource' },
      { code: 'missing_field', field: 'authorization_servers' },
    ])
  })
})
