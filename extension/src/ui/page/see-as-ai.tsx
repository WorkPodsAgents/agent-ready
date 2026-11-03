import type { AiView } from '../../shared/results'
import { Badge } from '../components/badge'
import { Card } from '../components/card'
import { Note } from '../components/notice'
import styles from './see-as-ai.module.css'
import { wordShare } from './word-share'

/** The raw HTML an AI fetcher reads next to the page a person sees after scripts run. */
export function SeeAsAi({ view }: { readonly view: AiView }) {
  const share = wordShare(view)
  return (
    <Card
      title="See as AI"
      subtitle={
        share === null
          ? 'What AI fetchers read, without running scripts.'
          : `AI fetchers get ${share}% of the words people see.`
      }
    >
      <div className={styles.sides}>
        <Side
          label="Raw HTML (AI fetchers)"
          words={view.rawWords}
          types={view.rawJsonLdTypes}
          text={view.rawText}
        />
        {view.renderedWords === null ? (
          <div className={styles.side}>
            <span className={styles.label}>Rendered page</span>
            <Note>Open the page in a tab and check it there to compare.</Note>
          </div>
        ) : (
          <Side
            label="Rendered (people)"
            words={view.renderedWords}
            types={view.renderedJsonLdTypes ?? []}
            text={view.renderedText ?? ''}
          />
        )}
      </div>
    </Card>
  )
}

function Side({
  label,
  words,
  types,
  text,
}: {
  readonly label: string
  readonly words: number
  readonly types: readonly string[]
  readonly text: string
}) {
  return (
    <div className={styles.side}>
      <span className={styles.label}>{label}</span>
      <span className={styles.words}>
        {words.toLocaleString('en-US')} <span className={styles.label}>words</span>
      </span>
      <div className={styles.types} aria-label="JSON-LD types">
        {types.length === 0 ? (
          <Badge tone="neutral">No JSON-LD</Badge>
        ) : (
          types.map((type) => (
            <Badge key={type} tone="accent">
              {type}
            </Badge>
          ))
        )}
      </div>
      <p className={styles.text}>{text === '' ? 'No visible text.' : text}</p>
    </div>
  )
}
