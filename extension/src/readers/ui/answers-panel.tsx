import { useCallback, useEffect, useState } from 'react'
import { score, toAiAnswer, type ScoredAnswer } from '../answers-core'
import { ENGINE_LABEL, engineFor, type ReadAnswer } from '../engines'
import {
  addToHistory,
  EMPTY_PANEL,
  panelProblem,
  partiesOf,
  readHistory,
  readPanel,
  type PromptPanel,
} from '../panel-store'
import { grantSites } from '../../ui/client'
import { askTab } from '../tab-client'
import { AssistRun } from './assist-run'
import { CloroRunView } from './cloro-run-view'
import { HistoryView } from './history-view'
import { PanelEditor } from './panel-editor'
import { Button, ErrorNote, Section, useAction, useActiveTab, type OpenTab } from './parts'
import { ScoreView } from './score-view'
import styles from './ui.module.css'

/** The AI answers tab: read the answer on screen, run the prompt panel, see the history. */
export function AnswersPanel() {
  const tab = useActiveTab()
  const [panel, setPanel] = useState<PromptPanel>(EMPTY_PANEL)
  const [history, setHistory] = useState<readonly ScoredAnswer[]>([])
  const refresh = useCallback(() => void readHistory().then(setHistory), [])

  useEffect(() => {
    void readPanel().then(setPanel)
    refresh()
  }, [refresh])

  return (
    <div className={styles.stack}>
      <ReadThisAnswer tab={tab} panel={panel} onSaved={refresh} />
      <PanelEditor panel={panel} onSaved={setPanel} />
      <RunPanel tab={tab} panel={panel} onAnswer={refresh} />
      <HistoryView history={history} />
    </div>
  )
}

function ReadThisAnswer(props: { tab: OpenTab | null; panel: PromptPanel; onSaved: () => void }) {
  const [reading, setReading] = useState<{ read: ReadAnswer; scored: ScoredAnswer } | null>(null)
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  const engine = props.tab === null ? null : engineFor(props.tab.url)
  const tab = props.tab

  const read = () =>
    run(async () => {
      if (tab === null) return
      await grantSites(tab.url)
      const answer = await askTab(tab, 'answers:read', {})
      if (answer === null) throw new Error('This page shows no AI answer yet.')
      const scored = score(toAiAnswer(answer, 'reader', new Date()), partiesOf(props.panel))
      setReading({ read: answer, scored })
      setSaved(false)
    })

  const save = () =>
    run(async () => {
      if (reading === null) return
      await addToHistory(reading.scored)
      setSaved(true)
      props.onSaved()
    })

  return (
    <Section
      title="This answer"
      action={
        engine === null ? null : (
          <Button kind="primary" disabled={busy} onClick={read}>
            Read {ENGINE_LABEL[engine.id]}
          </Button>
        )
      }
    >
      {engine === null ? (
        <p className={styles.note}>
          Open an answer on ChatGPT, Gemini, Claude, Perplexity, AI Mode or an AI Overview to see
          which brands it names and which sites it cites.
        </p>
      ) : null}
      {props.panel.brand === '' ? (
        <p className={styles.note}>Save your brand in the prompt panel to mark it in answers.</p>
      ) : null}
      <ErrorNote error={error} />
      {reading === null ? null : (
        <>
          {reading.read.streaming ? (
            <p className={styles.note}>The answer was still being written when it was read.</p>
          ) : null}
          <ScoreView scored={reading.scored} citations={reading.read.citations} />
          <div className={styles.row}>
            <Button disabled={busy || saved || props.panel.brand === ''} onClick={save}>
              {saved ? 'Saved' : 'Save to history'}
            </Button>
          </div>
        </>
      )}
    </Section>
  )
}

function RunPanel(props: { tab: OpenTab | null; panel: PromptPanel; onAnswer: () => void }) {
  const [mode, setMode] = useState<'assist' | 'cloro'>('assist')
  const problem = panelProblem(props.panel)
  return (
    <Section
      title="Run the panel"
      action={
        <select
          className={`${styles.select} ${styles.compact}`}
          value={mode}
          aria-label="How to run"
          onChange={(e) => setMode(e.target.value === 'cloro' ? 'cloro' : 'assist')}
        >
          <option value="assist">Assist (free)</option>
          <option value="cloro">Unattended (Cloro)</option>
        </select>
      }
    >
      {problem !== null ? (
        <p className={styles.note}>{problem}</p>
      ) : mode === 'assist' ? (
        <AssistRun panel={props.panel} tab={props.tab} onAnswer={props.onAnswer} />
      ) : (
        <CloroRunView panel={props.panel} onAnswer={props.onAnswer} />
      )}
    </Section>
  )
}
