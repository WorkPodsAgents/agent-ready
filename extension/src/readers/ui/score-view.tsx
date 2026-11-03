import type { ScoredAnswer, Visibility } from '../answers-core'
import type { CitedSource } from '../engines'
import { Badge, type Tone } from './parts'
import styles from './ui.module.css'

const VISIBILITY: Readonly<Record<Visibility, { label: string; tone: Tone }>> = {
  cited: { label: 'Cited', tone: 'good' },
  named: { label: 'Named', tone: 'info' },
  absent: { label: 'Absent', tone: 'neutral' },
}

export function VisibilityBadge({ status }: { status: Visibility }) {
  const { label, tone } = VISIBILITY[status]
  return <Badge tone={tone}>{label}</Badge>
}

/** The brand and each competitor in one answer, then the sources it cited. */
export function ScoreView(props: { scored: ScoredAnswer; citations: readonly CitedSource[] }) {
  return (
    <div className={styles.stack}>
      <ul className={styles.list}>
        {props.scored.parties.map((party) => (
          <li key={party.name} className={styles.item}>
            <div className={styles.spread}>
              <span className={styles.subtitle}>
                {party.name}
                {party.role === 'brand' ? ' (you)' : ''}
              </span>
              <span className={styles.row}>
                {party.mentionOrder === null ? null : (
                  <span className={styles.note}>Named #{party.mentionOrder}</span>
                )}
                <VisibilityBadge status={party.status} />
              </span>
            </div>
            {party.passage === null ? null : <p className={styles.quote}>{party.passage}</p>}
          </li>
        ))}
      </ul>
      <div className={styles.stack}>
        <h3 className={styles.subtitle}>Sources cited ({props.citations.length})</h3>
        {props.citations.length === 0 ? (
          <p className={styles.note}>This answer cited no sources.</p>
        ) : (
          <ol className={styles.list}>
            {props.citations.map((source) => (
              <li key={source.url}>
                <a className={styles.link} href={source.url} target="_blank" rel="noreferrer">
                  {source.title ?? source.url}
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
