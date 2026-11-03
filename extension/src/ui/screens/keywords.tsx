import type {
  KeywordIdeas,
  KeywordMetrics,
  KeywordView,
  Paid,
} from '@open-agent-ready/core/providers'
import { useState } from 'react'
import { SerpPanel } from '../../readers'
import { call, grantSites } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { FieldRow, TextArea, TextField } from '../components/field'
import { ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { Table } from '../components/table'
import type { Tone } from '../components/tone'
import { formatCount, paidNote, splitList } from '../paid-task'
import { useTask } from '../use-task'
import styles from './screens.module.css'

const SUGGEST_ORIGIN = 'https://suggestqueries.google.com/'
const IDEAS_LIMIT = 100

const VERDICT: Readonly<Record<KeywordView['verdict'], { tone: Tone; text: string }>> = {
  easy: { tone: 'good', text: 'Easy' },
  kd_understates: { tone: 'high', text: 'Harder than KD says' },
  possible: { tone: 'warn', text: 'Possible' },
  hard: { tone: 'bad', text: 'Hard' },
  unchecked: { tone: 'neutral', text: 'Top 10 strength unknown' },
  unknown: { tone: 'neutral', text: 'No difficulty reported' },
}

export function Keywords() {
  const [seeds, setSeeds] = useState('')
  return (
    <div className={styles.stack}>
      <Suggest onPick={(term) => setSeeds((text) => (text === '' ? term : `${text}\n${term}`))} />
      <Ideas seeds={seeds} setSeeds={setSeeds} />
      <SerpPanel />
    </div>
  )
}

function Suggest({ onPick }: { readonly onPick: (term: string) => void }) {
  const [seed, setSeed] = useState('')
  const list = useTask<string[]>()
  const run = () =>
    void list.run(async () => {
      await grantSites(SUGGEST_ORIGIN)
      return call('keywords:suggest', { seed })
    })
  return (
    <Card title="Autocomplete" subtitle="Free. What Google suggests as people type your seed.">
      <FieldRow>
        <TextField label="Seed term" value={seed} onChange={(e) => setSeed(e.target.value)} />
        <Button busy={list.task.kind === 'running'} disabled={seed.trim() === ''} onClick={run}>
          Suggest
        </Button>
      </FieldRow>
      {list.task.kind === 'failed' ? <ErrorNote>{list.task.error}</ErrorNote> : null}
      {list.value === null ? null : list.value.length === 0 ? (
        <Note>Google has no suggestions for that seed.</Note>
      ) : (
        <>
          <Note>Pick a suggestion to add it to the keyword ideas seeds.</Note>
          <div className={styles.chips}>
            {list.value.map((term) => (
              <button
                key={term}
                type="button"
                className={styles.chipButton}
                onClick={() => onPick(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function Ideas({
  seeds,
  setSeeds,
}: {
  readonly seeds: string
  readonly setSeeds: (s: string) => void
}) {
  const ideas = useTask<Paid<KeywordIdeas>>()
  const [picked, setPicked] = useState<string | null>(null)
  const list = splitList(seeds)
  const request =
    list.length === 0
      ? null
      : { op: 'keywords:ideas' as const, args: { seeds: list, limit: IDEAS_LIMIT } }
  const result = ideas.value
  return (
    <>
      <Card
        title="Keyword ideas"
        subtitle="DataForSEO, with your own account. Volume and difficulty for the US."
      >
        <TextArea
          label="Seeds"
          hint="One per line or comma separated."
          value={seeds}
          onChange={(e) => setSeeds(e.target.value)}
          rows={2}
        />
        <PaidAction
          request={request}
          label="Find ideas"
          busy={ideas.task.kind === 'running'}
          onRun={() =>
            request !== null && void ideas.run(() => call('keywords:ideas', request.args))
          }
        />
        {ideas.task.kind === 'failed' ? <ErrorNote>{ideas.task.error}</ErrorNote> : null}
        {result === null ? null : (
          <Note>
            {result.data.ideas.length} ideas
            {result.data.totalCount === null
              ? ''
              : ` of ${formatCount(result.data.totalCount)}`} · {paidNote(result)}. Pick a keyword
            to check who holds its top 10.
          </Note>
        )}
      </Card>
      {result === null ? null : (
        <Card title="Ideas" flush>
          <IdeasTable ideas={result.data.ideas} picked={picked} onPick={setPicked} />
        </Card>
      )}
      {picked === null ? null : <TopTen keyword={picked} />}
    </>
  )
}

function IdeasTable({
  ideas,
  picked,
  onPick,
}: {
  readonly ideas: readonly KeywordMetrics[]
  readonly picked: string | null
  readonly onPick: (keyword: string) => void
}) {
  return (
    <Table
      label="Keyword ideas"
      rows={ideas}
      rowKey={(row) => row.keyword}
      columns={[
        {
          label: 'Keyword',
          cell: (row) => (
            <button
              type="button"
              className={styles.chipButton}
              aria-pressed={row.keyword === picked}
              onClick={() => onPick(row.keyword)}
            >
              {row.keyword}
            </button>
          ),
        },
        { label: 'Volume', numeric: true, cell: (row) => formatCount(row.searchVolume) },
        { label: 'KD', numeric: true, cell: (row) => formatCount(row.keywordDifficulty) },
        { label: 'Intent', cell: (row) => row.intent ?? 'n/a' },
      ]}
    />
  )
}

/** Keyword difficulty next to the strength of the domains that hold the top 10. */
function TopTen({ keyword }: { readonly keyword: string }) {
  const view = useTask<Paid<KeywordView | null>>()
  const request = { op: 'keywords:view' as const, args: { keyword } }
  const result = view.value
  const data = result?.data ?? null
  return (
    <Card
      title={`Top 10 for “${keyword}”`}
      subtitle="A low KD can hide a results page held by strong domains."
    >
      <PaidAction
        request={request}
        label="Check the top 10"
        busy={view.task.kind === 'running'}
        onRun={() => void view.run(() => call('keywords:view', request.args))}
      />
      {view.task.kind === 'failed' ? <ErrorNote>{view.task.error}</ErrorNote> : null}
      {result !== null && data === null ? (
        <Note>DataForSEO has no data for this keyword.</Note>
      ) : null}
      {data === null || result === null ? null : (
        <>
          <div className={styles.chips}>
            <Badge tone={VERDICT[data.verdict].tone}>{VERDICT[data.verdict].text}</Badge>
            <Badge tone="neutral">KD {formatCount(data.keywordDifficulty)}</Badge>
            <Badge tone="neutral">Median domain rank {formatCount(data.medianDomainRank)}</Badge>
            <Badge tone="neutral">{data.strongDomains} strong domains</Badge>
          </div>
          <Note>{paidNote(result)}.</Note>
          <Table
            label="Top 10 results"
            rows={data.top10}
            rowKey={(row) => `${row.rank}`}
            columns={[
              { label: '#', numeric: true, cell: (row) => row.rank },
              { label: 'Domain', cell: (row) => row.domain },
              { label: 'Domain rank', numeric: true, cell: (row) => formatCount(row.domainRank) },
            ]}
          />
        </>
      )}
    </Card>
  )
}
