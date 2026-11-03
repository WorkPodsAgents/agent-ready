import { Badge, type Tone } from '../../readers/ui/parts'
import styles from '../../readers/ui/ui.module.css'
import type { JourneyResult, JourneyStep, Outcome } from '../types'

export const OUTCOME: Readonly<Record<Outcome, { label: string; tone: Tone }>> = {
  completed_read_only: { label: 'Found it', tone: 'good' },
  reached_confirmation: { label: 'Reached the final step', tone: 'good' },
  partial: { label: 'Partial', tone: 'warn' },
  blocked: { label: 'Blocked', tone: 'bad' },
  stopped_by_policy: { label: 'Stopped by the safety rules', tone: 'neutral' },
}

function describe(step: JourneyStep): string {
  const { action } = step
  const on = step.target === null || step.target === '' ? '' : ` "${step.target}"`
  switch (action.kind) {
    case 'click':
      return `Clicked${on || ' an unnamed control'}`
    case 'type':
      return `Typed "${action.text}" into${on || ' an unnamed field'}`
    case 'select':
      return `Chose "${action.value}" in${on || ' an unnamed list'}`
    case 'navigate':
      return `Opened ${action.url}`
    case 'scroll':
      return `Scrolled ${action.direction}`
    case 'finish':
      return `Finished: ${action.note}`
  }
}

/** One journey: its outcome, where it stopped, and every step in order. */
export function JourneyCard({ result }: { result: JourneyResult }) {
  const outcome = OUTCOME[result.outcome]
  return (
    <li className={styles.item}>
      <div className={styles.spread}>
        <span className={styles.subtitle}>{result.task}</span>
        <Badge tone={outcome.tone}>{outcome.label}</Badge>
      </div>
      <p className={styles.note}>
        {result.steps} steps from {result.startUrl}. {result.agent}.
      </p>
      {result.stoppedAt === null ? null : <p className={styles.quote}>{result.stoppedAt}</p>}
      <p className={styles.note}>
        WebMCP:{' '}
        {result.webMcpApi === null
          ? 'no page listed tools'
          : `${result.webMcpApi} listed ${result.webMcpTools.length} tools`}
      </p>
      <details>
        <summary className={styles.note}>Replay {result.trail.length} steps</summary>
        <ol className={styles.list}>
          {result.trail.map((step) => (
            <li key={step.index}>
              <span>
                {step.index}. {describe(step)}
              </span>
              <span className={`${styles.note} ${styles.link}`}> on {step.url}</span>
              {step.refused === null ? null : (
                <p className={styles.error}>Refused: {step.refused}</p>
              )}
              {step.error === null ? null : (
                <p className={styles.error}>Did not run: {step.error}</p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </li>
  )
}
