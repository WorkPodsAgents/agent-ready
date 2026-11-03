import { emit } from '../shared/events'
import { activeTab } from './active-tab'
import { handle } from './handle'

/**
 * A result picked on the Google results page. Checking it opens it in the tab, because This page
 * checks the live page; the user then starts the check, which is when Chrome can ask for access.
 */
export function registerSerpLinkHandlers(): void {
  handle('serp:audit-url', async ({ url }) => {
    const tab = await activeTab()
    await browser.tabs.update(tab.id, { url })
    emit('panel:open', { screen: 'page' })
    return null
  })
  handle('serp:compare-url', async ({ url }) => {
    emit('panel:open', { screen: 'competitors', competitorUrl: url })
    return null
  })
}
