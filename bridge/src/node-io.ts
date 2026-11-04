// The core's IO seams for Node: the CLI and the bridge's no-browser fallback fetch with Node's
// fetch and parse with linkedom, where the extension uses its service worker and DOMParser.
import { parseHTML } from 'linkedom'
import packageJson from '../package.json' with { type: 'json' }
import type {
  FetchRequest,
  FetchResponse,
  Fetcher,
  HtmlParser,
  Sleep,
} from '@open-agent-ready/core'

export const USER_AGENT = `AgentReady/${packageJson.version} (+https://github.com/WorkPodsAgents/agent-ready)`

/** A slow site must not hang a CI job; a page that takes longer is reported as unreachable. */
const REQUEST_TIMEOUT_MS = 20_000

export const nodeFetcher: Fetcher = {
  async fetch(request: FetchRequest): Promise<FetchResponse> {
    const response = await fetch(request.url, {
      redirect: 'manual',
      headers: {
        accept: request.accept ?? 'text/html',
        'user-agent': request.userAgent ?? USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
    return { url: request.url, status: response.status, headers, body: await response.text() }
  },
}

export const parseHtml: HtmlParser = (html) => parseHTML(html).document

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
