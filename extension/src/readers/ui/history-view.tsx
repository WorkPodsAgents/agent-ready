import { historyCsv, shareOfVoice, type ScoredAnswer } from '../answers-core'
import { ENGINE_LABEL, type EngineId } from '../engines'
import { Button, download, Section } from './parts'
import { VisibilityBadge } from './score-view'
import styles from './ui.module.css'

/** The newest answer for each prompt on each engine; history arrives newest first. */
function latest(history: readonly ScoredAnswer[]): ScoredAnswer[] {
  const seen = new Map<string, ScoredAnswer>()
  for (const answer of history) {
    const key = `${answer.engine}\n${answer.prompt}`
    if (!seen.has(key)) seen.set(key, answer)
  }
  return [...seen.values()]
}

const percent = (rate: number | null) => (rate === null ? '-' : `${Math.round(rate * 100)}%`)

/** Your brand per prompt and engine, share of voice against competitors, and a CSV export. */
export function HistoryView({ history }: { history: readonly ScoredAnswer[] }) {
  const current = latest(history)
  const engines = [...new Set(current.map((a) => a.engine))] as EngineId[]
  const prompts = [...new Set(current.map((a) => a.prompt))]
  const cell = (prompt: string, engine: EngineId) =>
    current.find((a) => a.prompt === prompt && a.engine === engine)?.parties[0]
  const voice = shareOfVoice(current)

  const exportCsv = () => download('ai-answer-history.csv', 'text/csv', historyCsv(history))

  return (
    <Section
      title="History"
      action={
        history.length === 0 ? null : (
          <Button kind="ghost" onClick={exportCsv}>
            Export CSV
          </Button>
        )
      }
    >
      {current.length === 0 ? (
        <p className={styles.note}>Answers you read or run appear here, per prompt and engine.</p>
      ) : (
        <>
          <div className={styles.scroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Prompt</th>
                  {engines.map((engine) => (
                    <th key={engine}>{ENGINE_LABEL[engine]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prompts.map((prompt) => (
                  <tr key={prompt}>
                    <td>{prompt}</td>
                    {engines.map((engine) => {
                      const brand = cell(prompt, engine)
                      return (
                        <td key={engine}>
                          {brand === undefined ? '-' : <VisibilityBadge status={brand.status} />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className={styles.subtitle}>Share of voice ({voice.answers} answers)</h3>
          <div className={styles.scroller}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Shows up in</th>
                  <th>Cited in</th>
                  <th>Share of voice</th>
                </tr>
              </thead>
              <tbody>
                {voice.parties.map((party) => (
                  <tr key={party.name}>
                    <td>
                      {party.name}
                      {party.role === 'brand' ? ' (you)' : ''}
                    </td>
                    <td>{percent(party.visibleRate)}</td>
                    <td>{party.cited}</td>
                    <td>{percent(party.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  )
}
