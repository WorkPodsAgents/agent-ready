import { useCallback, useEffect, useState } from 'react'
import { callBackground } from '../../readers/background-client'
import { grantSites } from '../../ui/client'
import { Button, ErrorNote, Section, useAction, useActiveTab } from '../../readers/ui/parts'
import styles from '../../readers/ui/ui.module.css'
import type { RunRequest, SourceAvailability } from '../handlers'
import { watchJourneys } from '../history'
import { MODEL_SOURCE_LABEL, type ModelSource } from '../models'
import { MAX_STEPS } from '../outcome'
import { SUGGESTED_TASKS } from '../tasks'
import type { JourneyResult } from '../types'
import { JourneyCard } from './step-replay'

const SOURCES: readonly ModelSource[] = ['anthropic', 'openai', 'gemini', 'chrome']

/**
 * Agent journeys: a model tries a key task on the site in a scratch tab, reading it as an agent
 * does, and the result shows where it got stuck. It never submits, pays, books or signs in.
 */
export function JourneysPanel() {
  const tab = useActiveTab()
  const [sources, setSources] = useState<SourceAvailability | null>(null)
  const [history, setHistory] = useState<readonly JourneyResult[]>([])
  const refresh = useCallback(
    () => void callBackground<JourneyResult[]>('journeys:history', {}).then(setHistory),
    [],
  )

  useEffect(() => {
    void callBackground<SourceAvailability>('journeys:sources', {}).then(setSources)
    refresh()
    return watchJourneys(refresh)
  }, [refresh])

  const origin = tab !== null && /^https?:/.test(tab.url) ? `${new URL(tab.url).origin}/` : ''

  return (
    <div className={styles.stack}>
      <RunJourney startUrl={origin} sources={sources} onDone={refresh} />
      <Section title="Results">
        {history.length === 0 ? (
          <p className={styles.note}>Finished journeys appear here with a replay of each step.</p>
        ) : (
          <ul className={styles.list}>
            {history.map((result) => (
              <JourneyCard key={`${result.startedAt}${result.task}`} result={result} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function RunJourney(props: {
  startUrl: string
  sources: SourceAvailability | null
  onDone: () => void
}) {
  const [task, setTask] = useState(SUGGESTED_TASKS[0] ?? '')
  const [startUrl, setStartUrl] = useState(props.startUrl)
  const available = SOURCES.filter((source) => props.sources?.[source] === true)
  const [source, setSource] = useState<ModelSource | null>(null)
  const { busy, error, run } = useAction()
  const chosen = source ?? available[0] ?? null

  useEffect(() => setStartUrl(props.startUrl), [props.startUrl])

  const start = () =>
    run(async () => {
      if (chosen === null) return
      await grantSites(startUrl)
      const request: RunRequest = { task, startUrl, source: chosen }
      await callBackground<JourneyResult>('journeys:run', request)
      props.onDone()
    })

  return (
    <Section title="Run a journey">
      <label className={styles.field}>
        Start page
        <input
          className={styles.input}
          value={startUrl}
          onChange={(e) => setStartUrl(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Task
        <select className={styles.select} value={task} onChange={(e) => setTask(e.target.value)}>
          {SUGGESTED_TASKS.map((suggested) => (
            <option key={suggested}>{suggested}</option>
          ))}
          {SUGGESTED_TASKS.includes(task) ? null : <option>{task}</option>}
        </select>
      </label>
      <label className={styles.field}>
        Or write your own
        <input className={styles.input} value={task} onChange={(e) => setTask(e.target.value)} />
      </label>
      <label className={styles.field}>
        Model
        <select
          className={styles.select}
          value={chosen ?? ''}
          onChange={(e) => setSource(e.target.value as ModelSource)}
        >
          {available.map((s) => (
            <option key={s} value={s}>
              {MODEL_SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {props.sources !== null && available.length === 0 ? (
        <p className={styles.note}>
          Add an Anthropic, OpenAI or Gemini key in Settings, or ask your agent to run journeys
          through the bridge.
        </p>
      ) : null}
      <p className={styles.note}>
        Runs in a background tab for up to {MAX_STEPS} steps. It stops before any form is sent, any
        order or booking is confirmed, or any sign-in.
      </p>
      <ErrorNote error={error} />
      <div className={styles.row}>
        {busy ? (
          <Button onClick={() => void callBackground<null>('journeys:stop', {})}>Stop</Button>
        ) : (
          <Button
            kind="primary"
            disabled={chosen === null || startUrl === '' || task.trim() === ''}
            onClick={start}
          >
            Run journey
          </Button>
        )}
      </div>
    </Section>
  )
}
