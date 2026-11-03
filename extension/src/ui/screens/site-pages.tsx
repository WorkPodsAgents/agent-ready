import type { SitePage } from '../../shared/results'
import { Badge } from '../components/badge'
import { Table } from '../components/table'
import styles from './screens.module.css'

function problems(page: SitePage): number {
  return page.findings.filter((f) => f.status === 'fail' || f.status === 'partial').length
}

/** Crawled pages, most problems first; `limit` keeps the side panel short. */
export function SitePagesTable({
  pages,
  limit,
}: {
  readonly pages: readonly SitePage[]
  readonly limit?: number
}) {
  const sorted = [...pages].sort((a, b) => problems(b) - problems(a))
  const shown = limit === undefined ? sorted : sorted.slice(0, limit)
  return (
    <>
      <Table
        label="Crawled pages"
        rows={shown}
        rowKey={(page) => page.url}
        columns={[
          {
            label: 'Page',
            cell: (page) => (
              <>
                <span className={styles.mono}>{new URL(page.url).pathname}</span>
                {page.title === null ? null : <div className={styles.muted}>{page.title}</div>}
              </>
            ),
          },
          {
            label: 'Status',
            numeric: true,
            cell: (page) => (
              <Badge tone={page.status >= 400 ? 'bad' : page.status >= 300 ? 'warn' : 'good'}>
                {page.status}
              </Badge>
            ),
          },
          { label: 'Words', numeric: true, cell: (page) => page.wordCount.toLocaleString('en-US') },
          { label: 'Problems', numeric: true, cell: problems },
        ]}
      />
      {shown.length < sorted.length ? (
        <p className={styles.footnote}>
          Showing {shown.length} of {sorted.length} pages. Open the full report for all of them.
        </p>
      ) : null}
    </>
  )
}
