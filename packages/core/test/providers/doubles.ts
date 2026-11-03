// In-memory stand-ins for the runtime seams, and a fetch stub that answers with recorded
// (synthetic) provider responses, so no test reaches a provider.
import { vi } from 'vitest'
import type { KeyValueStore } from '../../src/providers'

export function memoryStore(): KeyValueStore & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get(key) {
      // A round trip through JSON, as chrome.storage does.
      const value = data.get(key)
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
    },
    async set(key, value) {
      data.set(key, JSON.parse(JSON.stringify(value)))
    },
    async remove(key) {
      data.delete(key)
    },
  }
}

export async function fixture(provider: 'dataforseo' | 'cloro', name: string): Promise<unknown> {
  const module: { default: unknown } = await import(
    `../fixtures/providers/${provider}/${name}.json`
  )
  return module.default
}

export interface Sent {
  readonly url: string
  readonly headers: Headers
  readonly body: unknown
}

/** Stubs global fetch: each request path answers with the response given for it. */
export function stubFetch(routes: Record<string, Response | (() => Response)>): Sent[] {
  const sent: Sent[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const url = new URL(input)
    sent.push({
      url: input,
      headers: new Headers(init.headers),
      body: JSON.parse(String(init.body)),
    })
    const route = routes[url.pathname]
    if (route === undefined) throw new Error(`unexpected request to ${url.pathname}`)
    return typeof route === 'function' ? route() : route.clone()
  })
  return sent
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
