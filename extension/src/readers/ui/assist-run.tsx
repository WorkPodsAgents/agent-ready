import { useState } from 'react'
import { score, toAiAnswer, type ScoredAnswer } from '../answers-core'
import { ENGINE_LABEL, engineFor } from '../engines'
import { addToHistory, partiesOf, type PromptPanel } from '../panel-store'
import { grantSites } from '../../ui/client'
import { askTab } from '../tab-client'
import { Button, ErrorNote, useAction, type OpenTab } from './parts'
import { VisibilityBadge } from './score-view'
import styles from './ui.module.css'

/** Long enough for an engine that browses before it answers. */
const ANSWER_TIMEOUT_MS = 180_000

/**
 * Assist mode: the extension fills a prompt into the engine open in the active tab, the user
 * presses Enter, and the extension reads and scores the answer. It never sends a prompt itself.
 */
export function AssistRun(props: {
  panel: PromptPanel
  tab: OpenTab | null
  onAnswer: () => void
}) {
  const [waitingFor, setWaitingFor] = useState<string | null>(null)
  const [results, setResults] = useState<ReadonlyMap<string, ScoredAnswer>>(new Map())
  const { busy, error, run } = useAction()
  const engine = props.tab === null ? null : engineFor(props.tab.url)

  if (props.tab === null || engine === null) {
    return (
      <p className={styles.note}>
        Open ChatGPT, Gemini, Claude, Perplexity or Google in this tab. The extension fills in each
        prompt, you press Enter, and it reads the answer.
      </p>
    )
  }
  const tab = props.tab

  const ask = (prompt: string) =>
    run(async () => {
      await grantSites(tab.url)
      const filled = await askTab(tab, 'answers:fill', { prompt })
      if (!filled.filled) {
        throw new Error(`The prompt box on ${ENGINE_LABEL[engine.id]} was not found.`)
      }
      setWaitingFor(prompt)
      try {
        const read = await askTab(tab, 'answers:await', {
          before: filled.before,
          timeoutMs: ANSWER_TIMEOUT_MS,
        })
        if (read === null) {
          throw new Error('No new answer arrived. Press Enter in the chat to send it.')
        }
        const scored = score(toAiAnswer(read, 'assist', new Date(), prompt), partiesOf(props.panel))
        await addToHistory(scored)
        setResults((previous) => new Map(previous).set(prompt, scored))
        props.onAnswer()
      } finally {
        setWaitingFor(null)
      }
    })

  return (
    <div className={styles.stack}>
      <p className={styles.note}>
        On {ENGINE_LABEL[engine.id]}: press Fill, then press Enter in the chat yourself.
      </p>
      {waitingFor === null ? null : (
        <p className={styles.note} role="status">
          Waiting for you to send the prompt and for the answer to finish.
        </p>
      )}
      <ErrorNote error={error} />
      <ul className={styles.list}>
        {props.panel.prompts.map((prompt) => {
          const brand = results.get(prompt)?.parties[0]
          return (
            <li key={prompt} className={styles.spread}>
              <span>{prompt}</span>
              {brand === undefined ? (
                <Button kind="ghost" disabled={busy} onClick={() => ask(prompt)}>
                  Fill
                </Button>
              ) : (
                <VisibilityBadge status={brand.status} />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
