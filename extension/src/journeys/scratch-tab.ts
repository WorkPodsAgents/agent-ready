// The scratch tab a journey runs in, read and driven through injected scripts. The journey script
// runs in the extension's isolated world on a site the user granted; only the WebMCP listing
// runs in the page's own world, since that is where a site registers its tools.
import { browser } from 'wxt/browser'
import { requireHostAccess } from '../background/host-access'
import type { InPageCall, InPageReply } from './in-page'
import type { JourneyPage } from './session'
import type { ActionTarget, BrowseAction, Observation, WebMcpListing } from './types'
import type { PageReading } from './observe'

const SCRIPT = '/content-scripts/journey.js'
const SETTLE_MS = 600
const LOAD_TIMEOUT_MS = 15_000
const NO_WEB_MCP: WebMcpListing = { api: null, tools: [] }

/** Opens `url` in a new background tab on a site the user granted. */
export async function openScratchTab(url: string): Promise<JourneyPage> {
  await requireHostAccess(url)
  const tab = await browser.tabs.create({ url, active: false })
  if (tab.id === undefined) throw new Error('Chrome did not open a tab for the journey.')
  const page = new ScratchTab(tab.id)
  await page.settle()
  return page
}

class ScratchTab implements JourneyPage {
  constructor(private readonly tabId: number) {}

  async observe(): Promise<Observation> {
    let reading: PageReading
    try {
      reading = (await this.call({ op: 'observe' })) as PageReading
    } catch {
      return this.unreadable()
    }
    const webMcp = await this.webMcp().catch(() => NO_WEB_MCP)
    return { ...reading, webMcp }
  }

  async describe(ref: string): Promise<ActionTarget | null> {
    const target = await this.call({ op: 'describe', ref }).catch(() => null)
    return (target ?? null) as ActionTarget | null
  }

  async perform(action: BrowseAction): Promise<void> {
    if (action.kind === 'navigate') await browser.tabs.update(this.tabId, { url: action.url })
    else await this.call({ op: 'perform', action })
    await this.settle()
  }

  async close(): Promise<void> {
    await browser.tabs.remove(this.tabId).catch(() => undefined)
  }

  /** Waits for a navigation the last step started to load, then for scripts to render. */
  async settle(): Promise<void> {
    await sleep(SETTLE_MS)
    for (let waited = 0; waited < LOAD_TIMEOUT_MS; waited += SETTLE_MS) {
      const tab = await browser.tabs.get(this.tabId).catch(() => null)
      if (tab === null || tab.status === 'complete') return
      await sleep(SETTLE_MS)
    }
  }

  private async call(call: InPageCall): Promise<unknown> {
    const target = { tabId: this.tabId }
    await browser.scripting.executeScript({ target, files: [SCRIPT] })
    const [frame] = await browser.scripting.executeScript({
      target,
      func: callJourney,
      args: [call],
    })
    const reply = frame?.result as InPageReply | undefined
    if (reply === undefined) throw new Error('The page did not answer.')
    if (!reply.ok) throw new Error(reply.error)
    return reply.value
  }

  private async webMcp(): Promise<WebMcpListing> {
    const [frame] = await browser.scripting.executeScript({
      target: { tabId: this.tabId },
      world: 'MAIN',
      func: listWebMcp,
    })
    return (frame?.result as WebMcpListing | undefined) ?? NO_WEB_MCP
  }

  /** A page the journey wandered to that the user never granted, such as another site. */
  private async unreadable(): Promise<Observation> {
    const tab = await browser.tabs.get(this.tabId).catch(() => null)
    const url = tab?.url ?? tab?.pendingUrl ?? ''
    const host = URL.canParse(url) ? new URL(url).host : 'this site'
    return {
      url,
      title: tab?.title ?? '',
      elements: [],
      elementsTruncated: false,
      text: `Agent Ready has no access to ${host}, so this page cannot be read.`,
      textFullLength: null,
      webMcp: NO_WEB_MCP,
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// The functions below are copied into the page by executeScript, so they use nothing from
// outside their own bodies.

function callJourney(call: InPageCall): InPageReply {
  const run = (globalThis as Record<symbol, unknown>)[Symbol.for('open-agent-ready.journey')]
  if (typeof run !== 'function') return { ok: false, error: 'The journey script is not loaded.' }
  return (run as (call: InPageCall) => InPageReply)(call)
}

// AX1: try document.modelContext first, then navigator.modelContext, then the testing API, and
// record the one that answered. Listing tools never calls one.
async function listWebMcp(): Promise<WebMcpListing> {
  type Lister = () => unknown
  const page = globalThis as unknown as {
    document: { modelContext?: { getTools?: Lister } }
    navigator: {
      modelContext?: { getTools?: Lister }
      modelContextTesting?: { listTools?: Lister }
    }
  }
  const apis: [string, () => unknown][] = [
    ['document.modelContext.getTools()', () => page.document.modelContext?.getTools?.()],
    ['navigator.modelContext.getTools()', () => page.navigator.modelContext?.getTools?.()],
    [
      'navigator.modelContextTesting.listTools()',
      () => page.navigator.modelContextTesting?.listTools?.(),
    ],
  ]
  for (const [api, list] of apis) {
    try {
      const tools: unknown = await list()
      if (tools === undefined) continue
      const names = Array.isArray(tools)
        ? tools
            .map((t: unknown) => (t as { name?: unknown } | null)?.name)
            .filter((name): name is string => typeof name === 'string' && name !== '')
        : []
      return { api, tools: names.slice(0, 50) }
    } catch {
      // A page whose API throws is read as not having that API.
    }
  }
  return { api: null, tools: [] }
}
