import { useEffect, useRef, useState } from 'react'
import type { Cost } from '../../shared/api'
import { formatUsd } from '../../shared/cost'
import { callBackground } from '../background-client'
import { CLORO_ENGINES, type CloroEngine } from '../cloro-engines'
import type { CloroAnswer } from '../cloro-run'
import { ENGINE_LABEL } from '../engines'
import type { PromptPanel } from '../panel-store'
import { Button, ErrorNote, useAction } from './parts'
import styles from './ui.module.css'

/** Unattended runs with the user's own Cloro key, priced before they start. */
export function CloroRunView(props: { panel: PromptPanel; onAnswer: () => void }) {
  const [engines, setEngines] = useState<readonly CloroEngine[]>(CLORO_ENGINES)
  const [estimate, setEstimate] = useState<Cost | null>(null)
  const [done, setDone] = useState(0)
  const stopped = useRef(false)
  const { busy, error, run } = useAction()
  const total = props.panel.prompts.length * engines.length

  useEffect(() => {
    void callBackground<Cost>('answers:cloro-estimate', {
      prompts: props.panel.prompts.length,
      engines,
    }).then(setEstimate, () => setEstimate(null))
  }, [props.panel.prompts.length, engines])

  const toggle = (engine: CloroEngine) =>
    setEngines((current) =>
      current.includes(engine) ? current.filter((e) => e !== engine) : [...current, engine],
    )

  const start = () =>
    run(async () => {
      stopped.current = false
      setDone(0)
      for (const prompt of props.panel.prompts) {
        for (const engine of engines) {
          if (stopped.current) return
          await callBackground<CloroAnswer>('answers:cloro-ask', { engine, prompt })
          setDone((count) => count + 1)
          props.onAnswer()
        }
      }
    })

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        {CLORO_ENGINES.map((engine) => (
          <label key={engine} className={styles.row}>
            <input
              type="checkbox"
              checked={engines.includes(engine)}
              disabled={busy}
              onChange={() => toggle(engine)}
            />
            {ENGINE_LABEL[engine]}
          </label>
        ))}
      </div>
      <p className={styles.note}>
        {estimate === null
          ? 'Uses your Cloro key and your monthly Cloro cap.'
          : `${total} answers, about ${formatUsd(estimate.usd)} at most. Your monthly Cloro cap ` +
            'applies, and answers asked in the last few days come from the cache for free.'}
      </p>
      <ErrorNote error={error} />
      <div className={styles.row}>
        {busy ? (
          <>
            <span className={styles.note} role="status">
              {done} of {total} answers
            </span>
            <Button onClick={() => (stopped.current = true)}>Stop</Button>
          </>
        ) : (
          <Button kind="primary" disabled={engines.length === 0} onClick={start}>
            Run {total} answers
          </Button>
        )}
      </div>
    </div>
  )
}
