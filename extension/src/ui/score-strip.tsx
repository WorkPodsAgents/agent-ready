import type { Finding, Layer } from '@open-agent-ready/core'
import { LAYER_LABEL } from './layers'
import { layerScores, scoreText } from './score'
import styles from './score-strip.module.css'

/**
 * SEO, GEO and AXO for the checked page: passed over every check in the layer, and a bar of
 * passed, failing and untested. Each cell opens that layer's checks.
 */
export function ScoreStrip({
  findings,
  selected,
  onSelect,
}: {
  readonly findings: readonly Finding[] | null
  readonly selected: Layer | null
  readonly onSelect: (layer: Layer) => void
}) {
  const scores = findings === null ? null : layerScores(findings)
  return (
    <ul className={styles.strip} aria-label="Checks passed per layer">
      {(scores ?? layerScores([])).map((score) => {
        const text = scores === null ? null : scoreText(score)
        const total = score.judged + score.untested
        const share = (n: number) => (total === 0 ? 0 : (n / total) * 100)
        const failing = score.judged - score.passed
        const label = `${LAYER_LABEL[score.layer]}: ${score.passed} passed, ${failing} failing, ${
          score.untested
        } untested. Show these checks.`
        return (
          <li key={score.layer}>
            <button
              type="button"
              className={styles.cell}
              disabled={scores === null}
              aria-pressed={selected === score.layer}
              aria-label={scores === null ? undefined : label}
              title={scores === null ? undefined : label}
              onClick={() => onSelect(score.layer)}
            >
              <span className={styles.layer}>{LAYER_LABEL[score.layer]}</span>
              <span className={text === null ? `${styles.value} ${styles.muted}` : styles.value}>
                {text ?? 'Not checked'}
              </span>
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${share(score.passed)}%` }} />
                <span className={styles.missed} style={{ width: `${share(failing)}%` }} />
                <span className={styles.open} style={{ width: `${share(score.untested)}%` }} />
              </span>
              {scores === null ? null : (
                <span className={styles.detail}>
                  {failing > 0 ? `${failing} failing` : null}
                  {failing > 0 && score.untested > 0 ? ' · ' : null}
                  {score.untested > 0 ? `${score.untested} untested` : null}
                  {failing === 0 && score.untested === 0 ? 'All pass' : null}
                </span>
              )}
            </button>
          </li>
        )
      })}
      <li className={styles.cell}>
        <span className={styles.layer}>{LAYER_LABEL.aco}</span>
        <span className={`${styles.value} ${styles.muted}`}>Later</span>
        <span className={styles.bar} aria-hidden="true" />
      </li>
    </ul>
  )
}
