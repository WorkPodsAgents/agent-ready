import type { Layer } from '@open-agent-ready/core'
import { LAYER_LABEL } from '../layers'
import { SCORED_LAYERS } from '../score'
import styles from './layer-filter.module.css'

/** What each layer asks of a page, so a user can tell what its checks are for. */
const LAYER_QUESTION: Readonly<Record<Layer, string>> = {
  seo: 'Can search engines crawl, index and understand this page?',
  geo: 'Can AI answer engines reach, read and cite this page?',
  axo: 'Can an AI agent use this site: name its controls, call its forms as tools and finish key tasks?',
  aco: 'Can an AI agent buy here?',
}

/** All, SEO, GEO or AXO, with the chosen layer's question under it. */
export function LayerFilter({
  selected,
  onSelect,
}: {
  readonly selected: Layer | null
  readonly onSelect: (layer: Layer | null) => void
}) {
  const options: readonly (Layer | null)[] = [null, ...SCORED_LAYERS]
  return (
    <div className={styles.filter}>
      <div className={styles.options} role="group" aria-label="Show checks for">
        {options.map((option) => (
          <button
            key={option ?? 'all'}
            type="button"
            className={styles.option}
            aria-pressed={option === selected}
            onClick={() => onSelect(option)}
          >
            {option === null ? 'All' : LAYER_LABEL[option]}
          </button>
        ))}
      </div>
      {selected === null ? null : <p className={styles.question}>{LAYER_QUESTION[selected]}</p>}
    </div>
  )
}
