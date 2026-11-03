import type { Fetcher, FetchResponse } from '@open-agent-ready/core'
import type { ApiReply } from '../shared/api'

/** Sends each request to the service worker, which alone can read redirect hops. */
export const relayFetcher: Fetcher = {
  async fetch(request) {
    const reply = (await browser.runtime.sendMessage({
      type: 'net:fetch',
      payload: request,
    })) as ApiReply
    if (!reply.ok) throw new Error(reply.error)
    // The service worker answers net:fetch with its Fetcher's FetchResponse.
    return reply.result as FetchResponse
  },
}

export function parseHtml(html: string, url: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Relative links resolve against the page's URL, as they do in the browser tab.
  if (doc.querySelector('base[href]') === null) {
    const base = doc.createElement('base')
    base.href = url
    doc.head.prepend(base)
  }
  return doc
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
