import { CHECK_GROUP_LABEL, check, type Finding } from '@open-agent-ready/core'
import { fixPrompt, type FixContext } from '@open-agent-ready/core/report'
import { useState } from 'react'
import { Badge, SeverityBadge, StatusMark } from '../components/badge'
import { Button } from '../components/button'
import { statusTone } from '../components/tone'
import { groupFindings, type FindingGroup } from './checklist-groups'
import styles from './checklist.module.css'

interface RowActions {
  readonly fix: FixContext
  /** Marks the finding's element on the open page; absent when the page is not the open tab. */
  readonly onHighlight?: (selector: string) => void
}

const toFix = (finding: Finding) => finding.status === 'fail' || finding.status === 'partial'

/**
 * One bordered section per group with a single count on the right, so every section reads the
 * same whatever its number of checks. Sections with something to fix start open, and a row shows
 * only the check's name until it is opened, so the list stays scannable.
 */
export function Checklist({
  findings,
  expanded = false,
  ...actions
}: RowActions & {
  readonly findings: readonly Finding[]
  /** Opens every section and fold, for a view of one layer's few checks. */
  readonly expanded?: boolean
}) {
  return (
    <div className={styles.groups}>
      {groupFindings(findings).map((group) => (
        <Group key={group.group} group={group} expanded={expanded} {...actions} />
      ))}
    </div>
  )
}

function Group({
  group,
  expanded,
  ...actions
}: RowActions & { readonly group: FindingGroup; readonly expanded: boolean }) {
  const open = group.findings.filter(toFix)
  const rest = group.findings.filter((finding) => !toFix(finding))
  return (
    <details className={styles.group} open={expanded || open.length > 0}>
      <summary className={styles.groupHead}>
        <Chevron />
        <span className={styles.groupTitle}>{CHECK_GROUP_LABEL[group.group]}</span>
        <Tally findings={group.findings} />
      </summary>
      {open.length === 0 ? (
        <Rows findings={rest} {...actions} />
      ) : (
        <>
          <Rows findings={open} {...actions} />
          {rest.length === 0 ? null : (
            <details className={styles.fold} open={expanded}>
              <summary>
                <Chevron />
                {restLabel(rest)}
              </summary>
              <Rows findings={rest} {...actions} />
            </details>
          )}
        </>
      )}
    </details>
  )
}

/** "2 to fix" in the worst finding's tone, else how many passed, else untested. */
function Tally({ findings }: { readonly findings: readonly Finding[] }) {
  const open = findings.filter(toFix)
  const passed = findings.filter((finding) => finding.status === 'pass').length
  // groupFindings sorts worst first, so the first open finding sets the tone.
  const worst = open.at(0)
  if (worst !== undefined) {
    return (
      <span className={styles.tally}>
        <Badge tone={statusTone(worst.status, worst.severity)}>{open.length} to fix</Badge>
      </span>
    )
  }
  if (passed === 0) return <span className={`${styles.tally} ${styles.muted}`}>Untested</span>
  return (
    <span className={`${styles.tally} ${styles.passed}`}>
      <StatusMark status="pass" severity={null} />
      {passed < findings.length ? `${passed} pass` : passed === 1 ? 'Passes' : `All ${passed} pass`}
    </span>
  )
}

function restLabel(rest: readonly Finding[]): string {
  const passed = rest.filter((finding) => finding.status === 'pass').length
  const unjudged = rest.length - passed
  const parts = [
    passed > 0 ? `${passed} passed` : null,
    unjudged > 0 ? `${unjudged} untested` : null,
  ]
  return parts.filter((part) => part !== null).join(', ')
}

function Rows({ findings, ...actions }: RowActions & { readonly findings: readonly Finding[] }) {
  return (
    <ul className={styles.rows}>
      {findings.map((finding) => (
        <Row key={finding.checkId} finding={finding} {...actions} />
      ))}
    </ul>
  )
}

function Row({ finding, fix, onHighlight }: RowActions & { readonly finding: Finding }) {
  const [copied, setCopied] = useState(false)
  const selector = finding.evidence.find((e) => e.selector !== undefined)?.selector
  const actionable = toFix(finding)
  return (
    <li>
      <details className={styles.row}>
        <summary className={styles.rowHead}>
          <StatusMark status={finding.status} severity={finding.severity} />
          {/* Registry titles name the problem, so a passed or untested row says what was found. */}
          <span className={actionable ? styles.title : `${styles.title} ${styles.quiet}`}>
            {actionable ? check(finding.checkId).title : finding.summary}
          </span>
          {finding.severity === null ? null : <SeverityBadge severity={finding.severity} />}
        </summary>
        <div className={styles.rowBody}>
          <p className={styles.summary}>
            {actionable ? finding.summary : `Checks for: ${check(finding.checkId).title}.`}
          </p>
          {actionable ? (
            <div className={styles.actions}>
              {selector === undefined || onHighlight === undefined ? null : (
                <Button variant="ghost" onClick={() => onHighlight(selector)}>
                  Show on page
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(fixPrompt(finding, fix))
                    .then(() => setCopied(true))
                }}
              >
                {copied ? 'Copied' : 'Copy fix'}
              </Button>
            </div>
          ) : null}
        </div>
      </details>
    </li>
  )
}

function Chevron() {
  return (
    <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
