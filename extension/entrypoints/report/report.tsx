import { check } from '@open-agent-ready/core'
import { useEffect, useState } from 'react'
import { LogoMark } from '../../../vendor/workpods/logo/logo-mark'
import type { SitePage, SiteReport } from '../../src/shared/results'
import { call, errorText } from '../../src/ui/client'
import { Badge } from '../../src/ui/components/badge'
import { Card } from '../../src/ui/components/card'
import { Empty, ErrorNote } from '../../src/ui/components/notice'
import { Table } from '../../src/ui/components/table'
import { statusTone } from '../../src/ui/components/tone'
import { ExportBar } from '../../src/ui/export-bar'
import { Checklist } from '../../src/ui/page/checklist'
import { countsLine } from '../../src/ui/page/checklist-groups'
import { SitePagesTable } from '../../src/ui/screens/site-pages'
import styles from './report.module.css'

/** The last crawl at full width, with every page and its problems. */
export function Report() {
  const [report, setReport] = useState<SiteReport | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    call('site:last', {}).then(setReport, (failure: unknown) => setError(errorText(failure)))
  }, [])
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LogoMark size={28} />
        <div className={styles.titles}>
          <h1 className={styles.title}>Site report</h1>
          <span className={styles.meta}>
            {report ? `${report.startUrl} · ${report.pages.length} pages` : 'Agent Ready'}
          </span>
        </div>
      </header>
      <main className={styles.body}>
        {error === null ? null : <ErrorNote>{error}</ErrorNote>}
        {report === null ? (
          <Empty title="No crawl yet">Start a crawl from the Site tab in the side panel.</Empty>
        ) : null}
        {report ? <Body report={report} /> : null}
      </main>
    </div>
  )
}

function Body({ report }: { readonly report: SiteReport }) {
  return (
    <>
      <Card
        title="Site findings"
        subtitle={countsLine(report.findings)}
        actions={<ExportBar subject="site" />}
      >
        <Checklist findings={report.findings} fix={{ url: report.startUrl, from: 'crawl' }} />
      </Card>
      <Card title="Pages" flush>
        <SitePagesTable pages={report.pages} />
      </Card>
      <Card title="Problems by page" flush>
        <Table
          label="Problems by page"
          rows={report.pages.filter(hasProblems)}
          rowKey={(page) => page.url}
          columns={[
            { label: 'Page', cell: (page) => <span className={styles.path}>{page.url}</span> },
            {
              label: 'Problems',
              cell: (page) => (
                <div className={styles.problems}>
                  {page.findings
                    .filter((f) => f.status === 'fail' || f.status === 'partial')
                    .map((f) => (
                      <Badge key={f.checkId} tone={statusTone(f.status, f.severity)}>
                        {check(f.checkId).title}
                      </Badge>
                    ))}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}

function hasProblems(page: SitePage): boolean {
  return page.findings.some((f) => f.status === 'fail' || f.status === 'partial')
}
