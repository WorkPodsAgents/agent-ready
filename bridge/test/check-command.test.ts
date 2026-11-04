import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { main } from '../src/commands'
import { nodeFetcher } from '../src/node-io'
import packageJson from '../package.json' with { type: 'json' }

const PARAGRAPH =
  'Acme Running makes trail shoes for long days in rough country. Every pair is tested on ' +
  'rocky ground, wet roots and loose gravel before it ships, and we publish the results. '

function page(head: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}
<meta name="description" content="Trail running shoes tested on rough ground, with results.">
</head><body><h1>Trail running shoes</h1><main>${`<p>${PARAGRAPH.repeat(4)}</p>`.repeat(6)}
</main></body></html>`
}

const PAGES: Readonly<Record<string, string>> = {
  // Only low-severity problems: a title well past 60 characters.
  '/long-title': page(
    '<title>Acme Running trail shoes for long days in rough country, tested on rocks</title>' +
      '<link rel="canonical" href="/long-title">',
  ),
  // A high-severity problem: the page asks search engines not to index it.
  '/noindex': page(
    '<title>Trail running shoes | Acme Running</title><meta name="robots" content="noindex">' +
      '<link rel="canonical" href="/noindex">',
  ),
}

const receivedAgents: (string | undefined)[] = []

let server: Server
let origin: string

beforeAll(async () => {
  server = createServer((request, response) => {
    receivedAgents.push(request.headers['user-agent'])
    const body = PAGES[request.url ?? '']
    if (request.url === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain' }).end('User-agent: *\nAllow: /\n')
    } else if (body === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
    } else {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

async function exitCode(path: string, failOn: string): Promise<number> {
  return main(['check', `${origin}${path}`, '--json', '--fail-on', failOn], () => {})
}

describe('agent-ready check in CI', () => {
  it('identifies CLI requests with the published version and public support repository', async () => {
    receivedAgents.length = 0
    await exitCode('/long-title', 'high')
    expect(receivedAgents.length).toBeGreaterThan(0)
    expect(
      receivedAgents.every(
        (agent) =>
          agent ===
          `AgentReady/${packageJson.version} (+https://github.com/WorkPodsAgents/agent-ready)`,
      ),
    ).toBe(true)
  })

  it('preserves a caller-supplied crawler identity', async () => {
    await nodeFetcher.fetch({ url: `${origin}/long-title`, userAgent: 'CustomProbe/1.0' })
    expect(receivedAgents.at(-1)).toBe('CustomProbe/1.0')
  })

  it('passes a page with only low problems at --fail-on medium, and fails it at low', async () => {
    expect(await exitCode('/long-title', 'medium')).toBe(0)
    expect(await exitCode('/long-title', 'low')).toBe(1)
  })

  it('fails a page with a high-severity problem at the default level', async () => {
    expect(await main(['check', `${origin}/noindex`], () => {})).toBe(1)
  })

  it('refuses an unknown --fail-on level as a usage error', async () => {
    expect(await exitCode('/long-title', 'urgent')).toBe(2)
  })
})
