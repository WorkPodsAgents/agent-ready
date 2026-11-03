import type { PageCommand, RenderedPage } from '../shared/offscreen'

export interface ActiveTab {
  readonly id: number
  readonly url: string
}

export async function activeTab(): Promise<ActiveTab> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id === undefined || tab.url === undefined) throw new Error('No page is open.')
  if (!/^https?:/.test(tab.url)) throw new Error('Open a web page to check it.')
  return { id: tab.id, url: tab.url }
}

/** The live page after its scripts ran, read by the page content script. */
export async function renderedPage(tabId: number): Promise<RenderedPage> {
  return (await pageCommand(tabId, { target: 'page', op: 'snapshot' })) as RenderedPage
}

/** False when the element is no longer on the page. */
export async function highlight(tabId: number, selector: string): Promise<boolean> {
  return (await pageCommand(tabId, { target: 'page', op: 'highlight', selector })) === true
}

// The script is injected on demand, so pages the user never checks never run it. It ignores a
// second injection, so injecting before every command is safe.
async function pageCommand(tabId: number, command: PageCommand): Promise<unknown> {
  await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/page.js'] })
  return browser.tabs.sendMessage(tabId, command)
}
