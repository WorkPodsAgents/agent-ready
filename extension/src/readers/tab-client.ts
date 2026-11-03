import { browser } from 'wxt/browser'
import { originPattern } from '../background/host-access'
import type { ContentMessageType, ContentMessages } from './content-messages'

/** The reader each message needs, injected into the tab on demand. */
const READER = {
  'answers:read': '/content-scripts/answers.js',
  'answers:fill': '/content-scripts/answers.js',
  'answers:await': '/content-scripts/answers.js',
  'serp:read': '/content-scripts/serp.js',
} as const satisfies Record<ContentMessageType, string>

/** Where in the side panel the user allows each reader. */
const ALLOW_FROM: Readonly<Record<ContentMessageType, string>> = {
  'answers:read': 'AI answers',
  'answers:fill': 'AI answers',
  'answers:await': 'AI answers',
  'serp:read': 'Keywords',
}

export interface ReadableTab {
  readonly id: number
  readonly url: string
}

/**
 * Asks a tab's reader. The reader runs only on engines the user allowed, injected when asked, so
 * no AI engine or Google page is read until the user says so. The panel asks for the grant on the
 * user's click; the bridge cannot ask, so it gets a message saying where to allow it.
 */
export async function askTab<T extends ContentMessageType>(
  tab: ReadableTab,
  type: T,
  payload: ContentMessages[T]['request'],
): Promise<ContentMessages[T]['response']> {
  if (!(await browser.permissions.contains({ origins: [originPattern(tab.url)] }))) {
    throw new Error(
      `Agent Ready may not read ${new URL(tab.url).host} yet. ` +
        `Allow it from the ${ALLOW_FROM[type]} tab in the side panel.`,
    )
  }
  try {
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [READER[type]] })
    return (await browser.tabs.sendMessage(tab.id, {
      type,
      payload,
    })) as ContentMessages[T]['response']
  } catch {
    throw new Error('This tab cannot be read yet. Reload it and try again.')
  }
}

/** The tab a tool or the panel means: the one at `url` when given, else the active tab. */
export async function findTab(url?: string): Promise<ReadableTab | null> {
  const tabs =
    url === undefined
      ? await browser.tabs.query({ active: true, lastFocusedWindow: true })
      : (await browser.tabs.query({})).filter((tab) => tab.url === url)
  const tab = tabs[0]
  if (tab?.id === undefined || tab.url === undefined) return null
  return { id: tab.id, url: tab.url }
}
