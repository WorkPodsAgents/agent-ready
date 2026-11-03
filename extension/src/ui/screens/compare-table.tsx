import { check, type Finding } from '@open-agent-ready/core'
import type { PageComparison } from '../../shared/results'
import { Badge, StatusMark } from '../components/badge'
import { Table } from '../components/table'
import { wordShare } from '../page/word-share'
import styles from './screens.module.css'

interface Pair {
  readonly checkId: string
  readonly mine: Finding | null
  readonly theirs: Finding | null
}

const RANK = { fail: 0, partial: 1, pass: 2, not_applicable: 3 } as const

/** Every check side by side, the ones where the pages differ first. */
export function comparePairs(comparison: PageComparison): Pair[] {
  const theirs = new Map(comparison.theirs.findings.map((f) => [f.checkId, f]))
  const ids = new Set(
    [...comparison.mine.findings, ...comparison.theirs.findings].map((f) => f.checkId),
  )
  const mine = new Map(comparison.mine.findings.map((f) => [f.checkId, f]))
  const pairs = [...ids].map((checkId) => ({
    checkId,
    mine: mine.get(checkId) ?? null,
    theirs: theirs.get(checkId) ?? null,
  }))
  const differs = (pair: Pair) => pair.mine?.status !== pair.theirs?.status
  return pairs.sort(
    (a, b) =>
      Number(differs(b)) - Number(differs(a)) ||
      RANK[a.mine?.status ?? 'not_applicable'] - RANK[b.mine?.status ?? 'not_applicable'],
  )
}

function Mark({ finding }: { readonly finding: Finding | null }) {
  return finding === null ? (
    <span className={styles.muted}>n/a</span>
  ) : (
    <span title={finding.summary}>
      <StatusMark status={finding.status} severity={finding.severity} />
    </span>
  )
}

export function CompareTable({ comparison }: { readonly comparison: PageComparison }) {
  const { mine, theirs } = comparison
  const share = (side: typeof mine) => {
    const value = wordShare(side.view)
    return value === null ? 'n/a' : `${value}%`
  }
  return (
    <>
      <Table
        label="Page facts"
        rows={[
          { fact: 'Words in raw HTML', mine: mine.view.rawWords, theirs: theirs.view.rawWords },
          { fact: 'Words AI fetchers get', mine: share(mine), theirs: share(theirs) },
          {
            fact: 'JSON-LD types',
            mine: mine.view.rawJsonLdTypes.length,
            theirs: theirs.view.rawJsonLdTypes.length,
          },
          { fact: 'HTTP status', mine: mine.status, theirs: theirs.status },
        ]}
        rowKey={(row) => row.fact}
        columns={[
          { label: 'Fact', cell: (row) => row.fact },
          { label: 'Yours', numeric: true, cell: (row) => row.mine },
          { label: 'Theirs', numeric: true, cell: (row) => row.theirs },
        ]}
      />
      <Table
        label="Checks compared"
        rows={comparePairs(comparison)}
        rowKey={(pair) => pair.checkId}
        columns={[
          {
            label: 'Check',
            cell: (pair) => (
              <>
                {check(pair.checkId).title}
                {pair.mine?.status !== pair.theirs?.status ? (
                  <>
                    {' '}
                    <Badge tone="accent">Differs</Badge>
                  </>
                ) : null}
              </>
            ),
          },
          { label: 'Yours', cell: (pair) => <Mark finding={pair.mine} /> },
          { label: 'Theirs', cell: (pair) => <Mark finding={pair.theirs} /> },
        ]}
      />
    </>
  )
}
