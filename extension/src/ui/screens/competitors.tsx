import type { CompetitorDomain, CompetitorGap, Paid } from '@open-agent-ready/core/providers'
import { useEffect, useState } from 'react'
import { bareHost, toUrl } from '../../shared/host'
import type { PageComparison } from '../../shared/results'
import { call, grantSites } from '../client'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { FieldRow, TextField } from '../components/field'
import { ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { Table } from '../components/table'
import { ExportBar } from '../export-bar'
import { formatCount, paidNote, splitList } from '../paid-task'
import { useTask } from '../use-task'
import { CompareTable } from './compare-table'
import styles from './screens.module.css'

const DISCOVER_LIMIT = 20
const GAP_LIMIT = 50

export function Competitors({
  url,
  compareWith,
}: {
  readonly url: string | null
  /** A competitor page picked elsewhere, such as a result on the Google results page. */
  readonly compareWith: string | null
}) {
  const [competitors, setCompetitors] = useState('')
  const domain = url === null ? '' : bareHost(url)
  return (
    <div className={styles.stack}>
      <Compare url={url} compareWith={compareWith} />
      <Discover
        domain={domain}
        onAdd={(found) =>
          setCompetitors((text) => [...new Set([...splitList(text), found])].join(', '))
        }
      />
      <Gap domain={domain} competitors={competitors} setCompetitors={setCompetitors} />
    </div>
  )
}

function Compare({
  url,
  compareWith,
}: {
  readonly url: string | null
  readonly compareWith: string | null
}) {
  const [mine, setMine] = useState(url ?? '')
  const [theirs, setTheirs] = useState('')
  useEffect(() => {
    if (compareWith !== null) setTheirs(compareWith)
  }, [compareWith])
  const compare = useTask<PageComparison>()
  useEffect(() => {
    void call('compare:last', {}).then((last) => {
      if (last !== null) compare.setTask({ kind: 'done', value: last })
    })
  }, [compare.setTask])
  useEffect(() => {
    if (url !== null) setMine((current) => (current === '' ? url : current))
  }, [url])
  const mineUrl = toUrl(mine)
  const theirsUrl = toUrl(theirs)
  const run = () => {
    if (mineUrl === null || theirsUrl === null) return
    void compare.run(async () => {
      await grantSites(mineUrl, theirsUrl)
      return call('compare', { url: mineUrl, competitorUrl: theirsUrl })
    })
  }
  return (
    <Card
      title="Compare pages"
      subtitle="Free. Your page and a competitor's, check by check."
      actions={compare.value === null ? undefined : <ExportBar subject="compare" />}
    >
      <TextField label="Your page" value={mine} onChange={(e) => setMine(e.target.value)} />
      <FieldRow>
        <TextField
          label="Competitor page"
          placeholder="competitor.com/pricing"
          value={theirs}
          onChange={(e) => setTheirs(e.target.value)}
        />
        <Button
          variant="primary"
          busy={compare.task.kind === 'running'}
          disabled={mineUrl === null || theirsUrl === null}
          onClick={run}
        >
          Compare
        </Button>
      </FieldRow>
      {compare.task.kind === 'failed' ? <ErrorNote>{compare.task.error}</ErrorNote> : null}
      {compare.value === null ? null : <CompareTable comparison={compare.value} />}
    </Card>
  )
}

function Discover({
  domain,
  onAdd,
}: {
  readonly domain: string
  readonly onAdd: (d: string) => void
}) {
  const found = useTask<Paid<readonly CompetitorDomain[]>>()
  const request =
    domain === ''
      ? null
      : { op: 'competitors:discover' as const, args: { domain, limit: DISCOVER_LIMIT } }
  const result = found.value
  return (
    <Card
      title="Who competes with you"
      subtitle={`DataForSEO. Domains ranking for the same keywords as ${domain || 'your site'}.`}
    >
      <PaidAction
        request={request}
        label="Find competitors"
        busy={found.task.kind === 'running'}
        onRun={() =>
          request !== null && void found.run(() => call('competitors:discover', request.args))
        }
      />
      {found.task.kind === 'failed' ? <ErrorNote>{found.task.error}</ErrorNote> : null}
      {result === null ? null : (
        <>
          <Note>{paidNote(result)}. Add a domain to the keyword gap below.</Note>
          <Table
            label="Competing domains"
            rows={result.data}
            rowKey={(row) => row.domain}
            columns={[
              {
                label: 'Domain',
                cell: (row) => (
                  <button
                    type="button"
                    className={styles.chipButton}
                    onClick={() => onAdd(row.domain)}
                  >
                    {row.domain}
                  </button>
                ),
              },
              {
                label: 'Shared keywords',
                numeric: true,
                cell: (row) => formatCount(row.sharedKeywords),
              },
              {
                label: 'Avg. position',
                numeric: true,
                cell: (row) => formatCount(row.avgPosition),
              },
            ]}
          />
        </>
      )}
    </Card>
  )
}

function Gap({
  domain,
  competitors,
  setCompetitors,
}: {
  readonly domain: string
  readonly competitors: string
  readonly setCompetitors: (text: string) => void
}) {
  const gap = useTask<Paid<readonly CompetitorGap[]>>()
  const list = splitList(competitors)
  const request =
    domain === '' || list.length === 0
      ? null
      : { op: 'competitors:gap' as const, args: { domain, competitors: list, limit: GAP_LIMIT } }
  return (
    <Card title="Keyword gap" subtitle="DataForSEO. Keywords competitors rank for and you do not.">
      <TextField
        label="Competitors"
        hint="Domains, comma separated."
        value={competitors}
        onChange={(e) => setCompetitors(e.target.value)}
      />
      <PaidAction
        request={request}
        label="Find the gap"
        busy={gap.task.kind === 'running'}
        onRun={() => request !== null && void gap.run(() => call('competitors:gap', request.args))}
      />
      {gap.task.kind === 'failed' ? <ErrorNote>{gap.task.error}</ErrorNote> : null}
      {gap.value === null ? null : (
        <>
          <Note>{paidNote(gap.value)}.</Note>
          {gap.value.data.map((competitor) => (
            <Table
              key={competitor.competitor}
              label={`Keywords ${competitor.competitor} ranks for`}
              rows={competitor.keywords}
              rowKey={(row) => row.keyword}
              columns={[
                { label: `${competitor.competitor} ranks for`, cell: (row) => row.keyword },
                { label: 'Volume', numeric: true, cell: (row) => formatCount(row.searchVolume) },
                { label: 'KD', numeric: true, cell: (row) => formatCount(row.keywordDifficulty) },
                {
                  label: 'Their position',
                  numeric: true,
                  cell: (row) => formatCount(row.position),
                },
              ]}
            />
          ))}
        </>
      )}
    </Card>
  )
}
