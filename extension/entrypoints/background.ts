import { registerExportHandlers } from '../src/background/export'
import { listenForRetries, syncBridgeLink, watchLinkState } from '../src/background/bridge-link'
import { watchRedirects } from '../src/background/fetcher'
import { listenForRequests } from '../src/background/messages'
import { registerNetHandlers } from '../src/background/net'
import { registerPageHandlers } from '../src/background/page'
import { registerResearchHandlers } from '../src/background/research'
import { registerHandler } from '../src/background/router'
import { readSettings } from '../src/background/settings'
import { registerSerpLinkHandlers } from '../src/background/serp-links'
import { registerSiteHandlers } from '../src/background/site'
import { broadcastStatus, registerStatusHandlers, unlockOnDevice } from '../src/background/status'
import { registerToolHandlers } from '../src/background/tools'
import { closeStorageToPages } from '../src/background/vault'
import { registerJourneyHandlers } from '../src/journeys'
import { registerReaderHandlers } from '../src/readers'

export default defineBackground(() => {
  // The toolbar button opens the side panel, which is the whole interface.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  void closeStorageToPages()
  watchRedirects()
  listenForRequests()

  registerNetHandlers()
  registerPageHandlers()
  registerSiteHandlers()
  registerExportHandlers()
  registerResearchHandlers()
  registerStatusHandlers()
  registerToolHandlers()
  registerSerpLinkHandlers()
  registerReaderHandlers(registerHandler)
  registerJourneyHandlers(registerHandler)

  watchLinkState(() => void broadcastStatus())
  listenForRetries(async () => (await readSettings()).agentLink)
  void unlockOnDevice().then(broadcastStatus)
  void readSettings().then((settings) => syncBridgeLink(settings.agentLink))
})
