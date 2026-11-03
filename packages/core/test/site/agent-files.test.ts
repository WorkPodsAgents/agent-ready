import { describe, expect, it } from 'vitest'
import { checkAgentCard, checkCatalog, checkServerCard, llmsTxtProblems } from '../../src/site'

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
    expect(catalog).toEqual({ problems: [], cards: ['/mcp-card.json'] })
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
