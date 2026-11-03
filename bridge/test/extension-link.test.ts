import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { EXTENSION_ORIGIN } from '@open-agent-ready/core/bridge'
import type { BridgeRequest, BridgeResponse } from '@open-agent-ready/core/bridge'
import { ExtensionLink } from '../src/extension-link'
import { createMcpServer } from '../src/mcp'

const links: ExtensionLink[] = []
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await Promise.all(links.splice(0).map((link) => link.close()))
})

async function startLink(): Promise<{ link: ExtensionLink; port: number }> {
  const port = 40_000 + Math.floor(Math.random() * 20_000)
  const link = new ExtensionLink({ port, allowedOrigin: EXTENSION_ORIGIN, log: () => {} })
  links.push(link)
  await link.listening()
  return { link, port }
}

/** Opens a socket as a client with this Origin; resolves with the open socket or the refusal. */
function connect(port: number, origin: string): Promise<WebSocket | number> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin })
  return new Promise((resolve) => {
    socket.on('open', () => {
      sockets.push(socket)
      resolve(socket)
    })
    socket.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
  })
}

describe('the extension link', () => {
  it('refuses a web page, or any origin other than the extension', async () => {
    const { link, port } = await startLink()

    expect(await connect(port, 'https://evil.example')).toBe(403)
    expect(await connect(port, 'chrome-extension://aaaabbbbccccddddeeeeffffgggghhhh')).toBe(403)
    expect(link.connected()).toBe(false)
  })

  it('accepts one extension at a time', async () => {
    const { port } = await startLink()

    expect(await connect(port, EXTENSION_ORIGIN)).toBeInstanceOf(WebSocket)
    expect(await connect(port, EXTENSION_ORIGIN)).toBe(409)
  })
})

describe('a tool call from an agent', () => {
  async function agentClient(link: ExtensionLink): Promise<Client> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    await createMcpServer(link, 'test').connect(serverSide)
    const client = new Client({ name: 'test-agent', version: '1' })
    await client.connect(clientSide)
    return client
  }

  it('reaches the extension as a bridge request and returns its result', async () => {
    const { link, port } = await startLink()
    const extension = await connect(port, EXTENSION_ORIGIN)
    if (!(extension instanceof WebSocket)) throw new Error(`refused: ${extension}`)
    const received: BridgeRequest[] = []
    extension.on('message', (data) => {
      const request = JSON.parse(String(data)) as BridgeRequest
      received.push(request)
      const response: BridgeResponse = { id: request.id, ok: true, result: { tabs: 1 } }
      extension.send(JSON.stringify(response))
    })
    const client = await agentClient(link)

    const result = await client.callTool({
      name: 'see_as_agent',
      arguments: { url: 'https://example.com/' },
    })

    expect(received).toEqual([
      { id: expect.any(String), tool: 'see_as_agent', args: { url: 'https://example.com/' } },
    ])
    expect(result.isError).toBeFalsy()
    expect(result.content).toEqual([{ type: 'text', text: '{"tabs":1}' }])
  })

  it('tells the user to open Chrome when a browser tool runs with no extension', async () => {
    const { link } = await startLink()
    const client = await agentClient(link)

    const result = await client.callTool({
      name: 'journey_observe',
      arguments: { url: 'https://example.com/', task: 'find the price' },
    })

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain(
      'Open Chrome with the extension installed and turn on Agent connection',
    )
  })
})
