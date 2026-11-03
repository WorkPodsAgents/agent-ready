import type {
  BacklinksSummary,
  LinkGap,
  Paid,
  ReferringDomains,
} from '@open-agent-ready/core/providers'
import { useEffect, useState } from 'react'
import { bareHost } from '../../shared/host'
import type { SiteReport } from '../../shared/results'
import { call, useEvent } from '../client'
import { Badge } from '../components/badge'
import { Card } from '../components/card'
import { TextField } from '../components/field'
import { Empty, ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { Table } from '../components/table'
import { formatCount, paidNote, splitList } from '../paid-task'
import { useTask } from '../use-task'
import styles from './screens.module.css'

const REFERRING_LIMIT = 100
const GAP_LIMIT = 100

export function Links({ url }: { readonly url: string | null }) {
  const target = url === null ? '' : bareHost(url)
  const summary = useTask<Paid<BacklinksSummary>>()
  return (
    <div className={styles.stack}>
      <Summary target={target} summary={summary} />
      <Referring target={target} />
      <Gap target={target} />
      <Broken brokenBacklinks={summary.value?.data.brokenBacklinks ?? null} />
    </div>
  )
}

function Summary({
  target,
  summary,
}: {
  readonly target: string
  readonly summary: ReturnType<typeof useTask<Paid<BacklinksSummary>>>
}) {
  const request = target === '' ? null : { op: 'links:summary' as const, args: { target } }
  const result = summary.value
  return (
    <Card title="Backlinks" subtitle={`DataForSEO Backlinks for ${target || 'your site'}.`}>
      <PaidAction
        request={request}
        label="Get the summary"
        busy={summary.task.kind === 'running'}
        onRun={() =>
          request !== null && void summary.run(() => call('links:summary', request.args))
        }
      />
      {summary.task.kind === 'failed' ? <ErrorNote>{summary.task.error}</ErrorNote> : null}
      {result === null ? null : (
        <>
          <div className={styles.kpis}>
            <Kpi label="Domain rank" value={result.data.rank} />
            <Kpi label="Referring domains" value={result.data.referringDomains} />
            <Kpi label="Backlinks" value={result.data.backlinks} />
            <Kpi label="Broken backlinks" value={result.data.brokenBacklinks} />
            <Kpi label="Spam score" value={result.data.spamScore} />
          </div>
          <Note>{paidNote(result)}.</Note>
        </>
      )}
    </Card>
  )
}

function Kpi({ label, value }: { readonly label: string; readonly value: number | null }) {
  return (
    <div className={styles.kpi}>
      <span className="ui-label">{label}</span>
      <span className={styles.kpiValue}>{formatCount(value)}</span>
    </div>
  )
}

function Referring({ target }: { readonly target: string }) {
  const domains = useTask<Paid<ReferringDomains>>()
  const request =
    target === ''
      ? null
      : { op: 'links:referring' as const, args: { target, limit: REFERRING_LIMIT } }
  const result = domains.value
  return (
    <Card title="Referring domains" subtitle="The sites that link to you, strongest first.">
      <PaidAction
        request={request}
        label="List domains"
        busy={domains.task.kind === 'running'}
        onRun={() =>
          request !== null && void domains.run(() => call('links:referring', request.args))
        }
      />
      {domains.task.kind === 'failed' ? <ErrorNote>{domains.task.error}</ErrorNote> : null}
      {result === null ? null : (
        <>
          <Note>
            {result.data.domains.length} of {formatCount(result.data.totalCount)} domains ·{' '}
            {paidNote(result)}.
          </Note>
          <Table
            label="Referring domains"
            rows={result.data.domains}
            rowKey={(row) => row.domain}
            columns={[
              { label: 'Domain', cell: (row) => row.domain },
              { label: 'Rank', numeric: true, cell: (row) => formatCount(row.rank) },
              { label: 'Links', numeric: true, cell: (row) => formatCount(row.backlinks) },
            ]}
          />
        </>
      )}
    </Card>
  )
}

function Gap({ target }: { readonly target: string }) {
  const [competitors, setCompetitors] = useState('')
  const gap = useTask<Paid<LinkGap>>()
  const list = splitList(competitors)
  const request =
    target === '' || list.length === 0
      ? null
      : { op: 'links:gap' as const, args: { domain: target, competitors: list, limit: GAP_LIMIT } }
  const result = gap.value
  return (
    <Card title="Link gap" subtitle="Domains that link to competitors and not to you.">
      <TextField
        label="Competitors"
        hint="Domains, comma separated, up to 20."
        value={competitors}
        onChange={(e) => setCompetitors(e.target.value)}
      />
      <PaidAction
        request={request}
        label="Find the gap"
        busy={gap.task.kind === 'running'}
        onRun={() => request !== null && void gap.run(() => call('links:gap', request.args))}
      />
      {gap.task.kind === 'failed' ? <ErrorNote>{gap.task.error}</ErrorNote> : null}
      {result === null ? null : (
        <>
          <Note>{paidNote(result)}.</Note>
          <Table
            label="Link gap domains"
            rows={result.data.domains}
            rowKey={(row) => row.domain}
            columns={[
              { label: 'Domain', cell: (row) => row.domain },
              { label: 'Rank', numeric: true, cell: (row) => formatCount(row.rank) },
              {
                label: 'Links to',
                cell: (row) => (
                  <div className={styles.chips}>
                    {row.linksTo.map((competitor) => (
                      <Badge key={competitor} tone="neutral">
                        {competitor}
                      </Badge>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </Card>
  )
}

/** Pages the last crawl found broken: any backlink pointing at one is wasted. */
function Broken({ brokenBacklinks }: { readonly brokenBacklinks: number | null }) {
  const [report, setReport] = useState<SiteReport | null>(null)
  useEffect(() => {
    void call('site:last', {}).then(setReport)
  }, [])
  useEvent('crawl:saved', setReport)
  const broken = report?.pages.filter((page) => page.status >= 400) ?? []
  return (
    <Card
      title="Broken pages"
      subtitle="Pages your last crawl found broken. Links pointing at them are wasted."
    >
      {brokenBacklinks === null ? null : (
        <Note>DataForSEO counts {formatCount(brokenBacklinks)} backlinks to broken pages.</Note>
      )}
      {report === null ? (
        <Empty title="No crawl yet">Run a crawl in the Site tab to find broken pages.</Empty>
      ) : broken.length === 0 ? (
        <Note>Your last crawl found no broken pages.</Note>
      ) : (
        <Table
          label="Broken pages"
          rows={broken}
          rowKey={(page) => page.url}
          columns={[
            { label: 'Page', cell: (page) => <span className={styles.mono}>{page.url}</span> },
            {
              label: 'Status',
              numeric: true,
              cell: (page) => <Badge tone="bad">{page.status}</Badge>,
            },
          ]}
        />
      )}
    </Card>
  )
}
