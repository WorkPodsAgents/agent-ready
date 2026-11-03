import { useEffect, useState } from 'react'
import {
  blockedText,
  type CrawlProgress,
  type CrawlStop,
  type SiteReport,
} from '../../shared/results'
import { call, grantSites, useEvent } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { FieldRow, TextArea, TextField } from '../components/field'
import { ErrorNote, Note } from '../components/notice'
import { Checklist } from '../page/checklist'
import { countsLine } from '../page/checklist-groups'
import { ExportBar } from '../export-bar'
import { useTask } from '../use-task'
import { SitePagesTable } from './site-pages'
import { SiteFilesCard } from './site-files'
import styles from './screens.module.css'

const DEFAULT_LIMIT = 200
const STOP_TEXT: Readonly<Record<CrawlStop, string | null>> = {
  complete: null,
  limit: 'Stopped at the page limit.',
  stopped: 'Stopped by you.',
}

export function Site({ url }: { readonly url: string | null }) {
  const crawl = useTask<SiteReport>()
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT))
  const [pinned, setPinned] = useState('')
  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  useEvent('crawl:progress', setProgress)
  useEffect(() => {
    void call('site:last', {}).then((last) => {
      if (last !== null) crawl.setTask({ kind: 'done', value: last })
    })
    // Loads the last crawl once, when the panel opens.
  }, [crawl.setTask])
  const running = crawl.task.kind === 'running'
  const start = () => {
    if (url === null) return
    const pages = pinned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    setProgress(null)
    void crawl.run(async () => {
      await grantSites(url, ...pages)
      return call('site:crawl', { url, limit: Number(limit) || DEFAULT_LIMIT, pinned: pages })
    })
  }
  const report = crawl.value
  return (
    <div className={styles.stack}>
      <SiteFilesCard url={url} />
      <Card
        title="Site health"
        subtitle="A polite crawl: one page at a time, honouring robots.txt."
      >
        <FieldRow>
          <TextField
            label="Page limit"
            type="number"
            min={1}
            max={2000}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          {running ? (
            <Button variant="danger" onClick={() => void call('site:crawl:stop', {})}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" disabled={url === null} onClick={start}>
              Start crawl
            </Button>
          )}
        </FieldRow>
        <TextArea
          label="Money pages"
          hint="One URL per line. These are crawled first, whatever the limit."
          value={pinned}
          onChange={(e) => setPinned(e.target.value)}
          rows={3}
        />
        {running && progress !== null ? <CrawlProgressBar progress={progress} /> : null}
        {crawl.task.kind === 'failed' ? <ErrorNote>{crawl.task.error}</ErrorNote> : null}
      </Card>
      {report === null ? null : <SiteReportCards report={report} />}
    </div>
  )
}

function CrawlProgressBar({ progress }: { readonly progress: CrawlProgress }) {
  const share = Math.min(100, (progress.done / Math.max(1, progress.limit)) * 100)
  return (
    <div className={styles.stack}>
      <div
        className={styles.progress}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.limit}
        aria-valuenow={progress.done}
      >
        <span className={styles.progressFill} style={{ width: `${share}%` }} />
      </div>
      <span className={styles.muted}>
        {progress.done} of up to {progress.limit} pages
        {progress.currentUrl === null ? '' : ` · ${progress.currentUrl}`}
      </span>
    </div>
  )
}

function SiteReportCards({ report }: { readonly report: SiteReport }) {
  const stop = STOP_TEXT[report.stop]
  const finished = new Date(report.finishedAt).toLocaleString('en-US')
  const problems = report.pages.filter((page) =>
    page.findings.some((f) => f.status === 'fail' || f.status === 'partial'),
  ).length
  return (
    <>
      <Card
        title="Crawl report"
        subtitle={`${new URL(report.startUrl).host} · ${finished}`}
        actions={
          <Button
            variant="ghost"
            onClick={() =>
              void browser.tabs.create({ url: browser.runtime.getURL('/report.html') })
            }
          >
            Open full report
          </Button>
        }
      >
        <div className={styles.kpis}>
          <Kpi label="Pages crawled" value={report.pages.length} />
          <Kpi label="Pages with problems" value={problems} />
          <Kpi label="Site findings" value={report.findings.length} />
        </div>
        {stop === null ? null : <Note>{stop}</Note>}
        {blockedText(report) === null ? null : <Note>{blockedText(report)}</Note>}
        {report.findings.length === 0 ? null : (
          <>
            <span className={styles.muted}>{countsLine(report.findings)}</span>
            <Checklist findings={report.findings} fix={{ url: report.startUrl, from: 'crawl' }} />
          </>
        )}
        <div className={styles.chips}>
          <Badge tone="neutral">Export</Badge>
          <ExportBar subject="site" />
        </div>
      </Card>
      <Card title="Pages" flush>
        <SitePagesTable pages={report.pages} limit={50} />
      </Card>
    </>
  )
}

function Kpi({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className={styles.kpi}>
      <span className="ui-label">{label}</span>
      <span className={styles.kpiValue}>{value.toLocaleString('en-US')}</span>
    </div>
  )
}
