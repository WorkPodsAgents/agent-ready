// The service worker's Fetcher. A browser fetch with redirect: 'manual' hides the redirect behind
// an opaque response with no status and no Location, so the hop is read from webRequest, which
// reports both for any host the user granted.
import type { FetchRequest, FetchResponse, Fetcher } from '@open-agent-ready/core'

interface Hop {
  readonly status: number
  readonly location: string
}

const hops = new Map<string, Hop>()
const HOP_WAIT_MS = 1_000

let watching = false

/**
 * Listens for redirect answers to the extension's own requests (tab id -1) once the user has
 * granted webRequest with a site, now or later; before that there is nothing to listen with.
 */
export function watchRedirects(): void {
  void browser.permissions.contains({ permissions: ['webRequest'] }).then((granted) => {
    if (granted) listen()
  })
  browser.permissions.onAdded.addListener((added) => {
    if (added.permissions?.includes('webRequest') === true) listen()
  })
}

function listen(): void {
  if (watching) return
  watching = true
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.statusCode < 300 || details.statusCode > 399) return undefined
      const location = details.responseHeaders?.find((h) => h.name.toLowerCase() === 'location')
      if (location?.value !== undefined) {
        hops.set(details.url, { status: details.statusCode, location: location.value })
      }
      return undefined
    },
    { urls: ['<all_urls>'], tabId: -1 },
    ['responseHeaders'],
  )
}

export const extensionFetcher: Fetcher = {
  async fetch(request: FetchRequest): Promise<FetchResponse> {
    hops.delete(request.url)
    const response = await fetch(request.url, {
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      headers: { accept: request.accept ?? 'text/html' },
    })
    if (response.type === 'opaqueredirect') return redirectAnswer(request.url)
    const headers: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value
    })
    return { url: request.url, status: response.status, headers, body: await response.text() }
  },
}

// webRequest reports the hop on its own channel, which can arrive just after fetch resolves.
async function redirectAnswer(url: string): Promise<FetchResponse> {
  const started = Date.now()
  while (Date.now() - started < HOP_WAIT_MS) {
    const hop = hops.get(url)
    if (hop !== undefined) {
      hops.delete(url)
      return { url, status: hop.status, headers: { location: hop.location }, body: '' }
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`${url} redirected, but the browser did not say where to.`)
}
