import {
  CHECK_GROUP_LABEL,
  type CheckGroup,
  type Finding,
  type Status,
} from '@open-agent-ready/core'

const GROUPS = Object.keys(CHECK_GROUP_LABEL) as CheckGroup[]
const STATUS_ORDER: Readonly<Record<Status, number>> = {
  fail: 0,
  partial: 1,
  pass: 2,
  not_applicable: 3,
}
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const

export interface FindingGroup {
  readonly group: CheckGroup
  readonly findings: readonly Finding[]
}

/** Findings by checklist group in the dashboard's order, worst first inside each group. */
export function groupFindings(findings: readonly Finding[]): FindingGroup[] {
  return GROUPS.flatMap((group) => {
    const inGroup = findings
      .filter((finding) => finding.group === group)
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.severity === null ? 4 : SEVERITY_ORDER[a.severity]) -
            (b.severity === null ? 4 : SEVERITY_ORDER[b.severity]),
      )
    return inGroup.length === 0 ? [] : [{ group, findings: inGroup }]
  })
}

/** "31 passed · 4 failing · 1 partial · 3 untested", leaving out the empty counts. */
export function countsLine(findings: readonly Finding[]): string {
  const count = (status: Status) => findings.filter((f) => f.status === status).length
  const parts = [
    `${count('pass')} passed`,
    count('fail') > 0 ? `${count('fail')} failing` : null,
    count('partial') > 0 ? `${count('partial')} partial` : null,
    count('not_applicable') > 0 ? `${count('not_applicable')} untested` : null,
  ]
  return parts.filter((part) => part !== null).join(' · ')
}
