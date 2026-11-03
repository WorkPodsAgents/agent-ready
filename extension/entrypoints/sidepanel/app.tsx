import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnswersPanel } from '../../src/readers'
import { JourneysPanel, useAgentTasks } from '../../src/journeys'
import type { Layer } from '@open-agent-ready/core'
import type { PageAudit } from '../../src/shared/results'
import { call, useEvent } from '../../src/ui/client'
import { Tabs } from '../../src/ui/components/tabs'
import { Header } from '../../src/ui/header'
import { OpenSettings, sectionId, type SettingsSection } from '../../src/ui/open-settings'
import { ScoreStrip } from '../../src/ui/score-strip'
import { Competitors } from '../../src/ui/screens/competitors'
import { Keywords } from '../../src/ui/screens/keywords'
import { Links } from '../../src/ui/screens/links'
import { Settings } from '../../src/ui/screens/settings'
import { Site } from '../../src/ui/screens/site'
import { ThisPage } from '../../src/ui/screens/this-page'
import { StatusProvider } from '../../src/ui/status-context'
import { TabAccess } from '../../src/ui/tab-access'
import { useActiveUrl, useTabAccess } from '../../src/ui/use-active-url'
import { useTask } from '../../src/ui/use-task'
import styles from './app.module.css'
import { sameDocument } from '../../src/shared/host'

type TabId =
  'page' | 'site' | 'answers' | 'keywords' | 'competitors' | 'links' | 'journeys' | 'settings'

/** Funnel order: the page, the site, AI answers, then research and agents. Settings opens from
    the header, so it never scrolls out of sight at the panel's width. */
const TABS: readonly { readonly id: Exclude<TabId, 'settings'>; readonly label: string }[] = [
  { id: 'page', label: 'This page' },
  { id: 'site', label: 'Site' },
  { id: 'answers', label: 'AI answers' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'links', label: 'Links' },
  { id: 'journeys', label: 'Journeys' },
]

export function App() {
  return (
    <StatusProvider>
      <Panel />
    </StatusProvider>
  )
}

function Panel() {
  const url = useActiveUrl()
  const tabAccess = useTabAccess()
  const host = url === null || !/^https?:/.test(url) ? null : new URL(url).host
  const [tab, setTab] = useState<TabId>(initialTab)
  const audit = useTask<PageAudit>()
  const [compareWith, setCompareWith] = useState<string | null>(null)
  const [section, setSection] = useState<SettingsSection | null>(null)
  // A score cell narrows This page to its layer; pressing it again shows every check.
  const [layer, setLayer] = useState<Layer | null>(null)
  const showLayer = (next: Layer) => {
    setTab('page')
    setLayer((current) => (current === next ? null : next))
  }
  const openSettings = useCallback((next: SettingsSection) => {
    setTab('settings')
    setSection(next)
  }, [])
  // Scrolls once the settings screen is shown; the section resets so the same chip works twice.
  useEffect(() => {
    if (tab !== 'settings' || section === null) return
    document.getElementById(sectionId(section))?.scrollIntoView({ block: 'start' })
    setSection(null)
  }, [tab, section])
  useEvent('panel:open', (open) => {
    setTab(open.screen)
    if (open.screen === 'competitors') setCompareWith(open.competitorUrl)
  })
  useEffect(() => {
    void call('page:last', {}).then((last) => {
      if (last !== null) audit.setTask({ kind: 'done', value: last })
    })
  }, [audit.setTask])
  const agentTasks = useAgentTasks(url)
  const current = audit.value
  // AX1 comes from the site's journeys, not the page audit, so it joins the audit's findings here.
  const findings =
    current !== null && url !== null && sameDocument(current.url, url)
      ? [...current.findings, ...(agentTasks === null ? [] : [agentTasks])]
      : null
  // Every screen stays mounted, so switching tabs keeps what the user typed and found.
  const screen = (id: TabId, children: ReactNode) => (
    <section
      key={id}
      id={`panel-${id}`}
      role={id === 'settings' ? 'region' : 'tabpanel'}
      aria-labelledby={id === 'settings' ? undefined : `tab-${id}`}
      aria-label={id === 'settings' ? 'Settings' : undefined}
      hidden={tab !== id}
      className={styles.screen}
    >
      {children}
    </section>
  )
  return (
    <OpenSettings value={openSettings}>
      <div className={styles.panel}>
        <Header host={host} settingsOpen={tab === 'settings'} />
        <ScoreStrip
          findings={findings}
          selected={tab === 'page' ? layer : null}
          onSelect={showLayer}
        />
        <Tabs tabs={TABS} selected={tab} onSelect={setTab} label="Agent Ready sections" />
        <main className={styles.body}>
          {tabAccess.granted === false && url === null ? (
            <TabAccess onAllow={tabAccess.allow} />
          ) : null}
          {screen(
            'page',
            <ThisPage
              url={url}
              audit={audit.task}
              findings={findings}
              layer={layer}
              onLayer={setLayer}
              onAudit={(work) => void audit.run(work)}
            />,
          )}
          {screen('site', <Site url={url} />)}
          {screen('answers', <AnswersPanel />)}
          {screen('keywords', <Keywords />)}
          {screen('competitors', <Competitors url={url} compareWith={compareWith} />)}
          {screen('links', <Links url={url} />)}
          {screen('journeys', <JourneysPanel />)}
          {screen('settings', <Settings />)}
        </main>
      </div>
    </OpenSettings>
  )
}

/** `#settings` opens that tab, so a link or a test can land on any screen. */
function initialTab(): TabId {
  const hash = location.hash.slice(1)
  if (hash === 'settings') return 'settings'
  return TABS.find((entry) => entry.id === hash)?.id ?? 'page'
}
