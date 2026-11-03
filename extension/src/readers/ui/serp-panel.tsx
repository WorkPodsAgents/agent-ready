import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { originPattern } from '../../background/host-access'
import { grantSites } from '../../ui/client'
import { callBackground } from '../background-client'
import { isGoogleSearch } from '../engines'
import type { SerpReading } from '../serp/read-serp'
import { askTab } from '../tab-client'
import { Badge, Button, ErrorNote, Section, useAction, useActiveTab } from './parts'
import styles from './ui.module.css'

/**
 * The Google results page open in the active tab: People Also Ask, related searches and the top
 * ten, each result one click from This page or Compare. Free: it reads what the user already sees.
 */
export function SerpPanel() {
  const tab = useActiveTab()
  const [reading, setReading] = useState<SerpReading | null>(null)
  const { busy, error, run } = useAction()
  const onResults = tab !== null && isGoogleSearch(tab.url)

  useEffect(() => {
    setReading(null)
    if (tab === null || !onResults) return
    // Once the user allowed this Google domain, each new results page is read as it opens.
    void browser.permissions.contains({ origins: [originPattern(tab.url)] }).then((allowed) => {
      if (allowed) run(async () => setReading(await askTab(tab, 'serp:read', {})))
    })
  }, [tab?.id, tab?.url])

  if (!onResults) {
    return (
      <Section title="Results page">
        <p className={styles.note}>
          Search on Google in this tab to see People Also Ask, related searches and the top ten
          results here.
        </p>
      </Section>
    )
  }

  const readResults = () =>
    run(async () => {
      await grantSites(tab.url)
      setReading(await askTab(tab, 'serp:read', {}))
    })

  const send = (type: 'serp:audit-url' | 'serp:compare-url', url: string) =>
    run(async () => {
      await callBackground<unknown>(type, { url })
    })

  return (
    <div className={styles.stack}>
      <Section
        title={reading?.query ?? 'Results page'}
        action={
          reading === null ? (
            <Button kind="primary" disabled={busy} onClick={readResults}>
              Read results
            </Button>
          ) : (
            <Badge tone={reading.aiOverview ? 'info' : 'neutral'}>
              {reading.aiOverview ? 'AI Overview shown' : 'No AI Overview'}
            </Badge>
          )
        }
      >
        <ErrorNote error={error} />
        {busy && reading === null ? <p className={styles.note}>Reading the results page.</p> : null}
        {reading === null ? null : (
          <ol className={styles.list}>
            {reading.organic.map((result) => (
              <li key={result.url} className={styles.item}>
                <span className={styles.subtitle}>
                  {result.position}. {result.title}
                </span>
                <span className={`${styles.note} ${styles.link}`}>{result.url}</span>
                <div className={styles.row}>
                  <Button
                    kind="ghost"
                    disabled={busy}
                    onClick={() => send('serp:audit-url', result.url)}
                  >
                    This page
                  </Button>
                  <Button
                    kind="ghost"
                    disabled={busy}
                    onClick={() => send('serp:compare-url', result.url)}
                  >
                    Compare
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
      {reading === null ? null : (
        <>
          <TextList title="People also ask" items={reading.peopleAlsoAsk} />
          <TextList title="Related searches" items={reading.relatedSearches} />
        </>
      )}
    </div>
  )
}

function TextList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <Section title={`${title} (${items.length})`}>
      {items.length === 0 ? (
        <p className={styles.note}>This results page shows none.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Section>
  )
}
