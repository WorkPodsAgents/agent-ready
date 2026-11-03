import { useEffect, useState } from 'react'
import { MAX_PROMPTS, MIN_PROMPTS, panelProblem, savePanel, type PromptPanel } from '../panel-store'
import { Button, ErrorNote, Section } from './parts'
import styles from './ui.module.css'

// Lists are typed one per line, the way people paste them from a spreadsheet.
const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
const commas = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

/** A competitor line is "Name, site.com, other-site.com". */
function parseCompetitors(text: string): PromptPanel['competitors'] {
  return lines(text).flatMap((line) => {
    const [name, ...domains] = commas(line)
    return name === undefined ? [] : [{ name, domains }]
  })
}

export function PanelEditor(props: { panel: PromptPanel; onSaved: (panel: PromptPanel) => void }) {
  const [brand, setBrand] = useState('')
  const [aliases, setAliases] = useState('')
  const [domains, setDomains] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [prompts, setPrompts] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBrand(props.panel.brand)
    setAliases(props.panel.aliases.join(', '))
    setDomains(props.panel.domains.join(', '))
    setCompetitors(props.panel.competitors.map((c) => [c.name, ...c.domains].join(', ')).join('\n'))
    setPrompts(props.panel.prompts.join('\n'))
  }, [props.panel])

  const save = () => {
    const panel: PromptPanel = {
      brand: brand.trim(),
      aliases: commas(aliases),
      domains: commas(domains),
      competitors: parseCompetitors(competitors),
      prompts: [...new Set(lines(prompts))],
    }
    const problem = panelProblem(panel)
    setError(problem)
    if (problem === null) void savePanel(panel).then(() => props.onSaved(panel))
  }

  return (
    <Section title="Prompt panel">
      <p className={styles.note}>
        {MIN_PROMPTS} to {MAX_PROMPTS} questions a buyer would ask an AI assistant. Saved on this
        device only.
      </p>
      <label className={styles.field}>
        Your brand
        <input className={styles.input} value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <label className={styles.field}>
        Other names for it, separated by commas
        <input
          className={styles.input}
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Your sites, separated by commas
        <input
          className={styles.input}
          value={domains}
          placeholder="example.com"
          onChange={(e) => setDomains(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Competitors, one per line: name, then their sites
        <textarea
          className={styles.textarea}
          value={competitors}
          placeholder="Acme Running, acmerunning.com"
          onChange={(e) => setCompetitors(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Prompts, one per line
        <textarea
          className={styles.textarea}
          value={prompts}
          onChange={(e) => setPrompts(e.target.value)}
        />
      </label>
      <ErrorNote error={error} />
      <div className={styles.row}>
        <Button kind="primary" onClick={save}>
          Save panel
        </Button>
      </div>
    </Section>
  )
}
