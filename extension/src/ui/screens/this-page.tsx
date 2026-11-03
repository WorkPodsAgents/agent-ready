import { useState } from 'react'
import type { Layer } from '@open-agent-ready/core'
import type { Finding, PageAudit } from '../../shared/results'
import { LAYER_LABEL } from '../layers'
import { LayerFilter } from '../page/layer-filter'
import { call, errorText, grantSites } from '../client'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { Empty, ErrorNote } from '../components/notice'
import { ExportBar } from '../export-bar'
import { Checklist } from '../page/checklist'
import { countsLine } from '../page/checklist-groups'
import { SeeAsAi } from '../page/see-as-ai'
import type { Task } from '../use-task'
import styles from './screens.module.css'
import { sameDocument } from '../../shared/host'

export function ThisPage({
  url,
  audit,
  findings,
  layer,
  onLayer,
  onAudit,
}: {
  readonly url: string | null
  readonly audit: Task<PageAudit>
  /** The audit's findings for this page with the site's AX1 verdict; null when not checked. */
  readonly findings: readonly Finding[] | null
  /** The layer the checklist shows; null shows every check. */
  readonly layer: Layer | null
  readonly onLayer: (layer: Layer | null) => void
  readonly onAudit: (work: () => Promise<PageAudit>) => void
}) {
  const [highlightError, setHighlightError] = useState<string | null>(null)
  const checkable = url !== null && /^https?:/.test(url)
  const start = () => {
    if (url === null) return
    onAudit(async () => {
      await grantSites(url)
      return call('page:audit', {})
    })
  }
  const highlight = (selector: string) => {
    call('page:highlight', { selector }).then(
      () => setHighlightError(null),
      (error: unknown) => setHighlightError(errorText(error)),
    )
  }
  const result = audit.kind === 'done' ? audit.value : null
  const shown = result !== null && url !== null && sameDocument(result.url, url) ? result : null
  const running = audit.kind === 'running'
  const all = findings ?? shown?.findings ?? []
  const listed = layer === null ? all : all.filter((finding) => finding.layer === layer)
  return (
    <div className={styles.stack}>
      {shown === null ? (
        <Empty
          title={checkable ? 'Check this page' : 'Open a web page to check it'}
          action={
            checkable ? (
              <Button variant="primary" busy={running} onClick={start}>
                {running ? 'Checking' : 'Check this page'}
              </Button>
            ) : null
          }
        >
          Runs every SEO, GEO and AXO check on the page in this tab: the raw HTML AI fetchers read,
          the rendered page, and its speed. Nothing leaves your browser.
        </Empty>
      ) : (
        <>
          <Card
            title={layer === null ? 'On-page checklist' : `${LAYER_LABEL[layer]} checks`}
            subtitle={countsLine(listed)}
            actions={
              <Button busy={running} onClick={start}>
                {running ? 'Checking' : 'Check again'}
              </Button>
            }
          >
            <LayerFilter selected={layer} onSelect={onLayer} />
            {highlightError === null ? null : <ErrorNote>{highlightError}</ErrorNote>}
            <Checklist
              findings={listed}
              expanded={layer !== null}
              fix={{ url: shown.url, from: 'check' }}
              onHighlight={highlight}
            />
          </Card>
          <SeeAsAi view={shown.view} />
          <Card title="Export" subtitle="Save this page's findings as a file.">
            <div className={styles.chips}>
              <ExportBar subject="page" />
            </div>
          </Card>
        </>
      )}
      {audit.kind === 'failed' ? <ErrorNote>{audit.error}</ErrorNote> : null}
    </div>
  )
}
