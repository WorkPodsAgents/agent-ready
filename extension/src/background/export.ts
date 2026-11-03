// The one file that calls the report lane's renderers, so the Markdown and JSON an export holds
// read the same as the CLI's.
import { check, type Finding } from '@open-agent-ready/core'
import { toJson, toMarkdown, type Report } from '@open-agent-ready/core/report'
import type { ReportSubject } from '../shared/api'
import {
  blockedText,
  type ExportFile,
  type ExportFormat,
  type PageAudit,
  type PageComparison,
  type SiteReport,
} from '../shared/results'
import { handle } from './handle'
import { idbGet } from './idb'
import { LAST_COMPARE, LAST_PAGE } from './page'
import { lastCrawl } from './site'

const NO_RENDER_NOTE =
  'Checked without the live page, so the checks that compare raw and rendered HTML were not run.'

export function pageReport(audit: PageAudit): Report {
  return {
    kind: 'page',
    url: audit.url,
    findings: audit.findings,
    notes: audit.view.renderedWords === null ? [NO_RENDER_NOTE] : [],
  }
}

export function crawlReport(report: SiteReport): Report {
  return {
    kind: 'site',
    url: report.startUrl,
    pagesCrawled: report.pages.length,
    stopReason: report.stop === 'complete' ? null : report.stop,
    findings: [...report.findings, ...report.pages.flatMap((page) => page.findings)],
    notes: [blockedText(report)].filter((note) => note !== null),
  }
}

async function reports(subject: ReportSubject): Promise<Report[]> {
  switch (subject) {
    case 'page': {
      const audit = await idbGet<PageAudit>('results', LAST_PAGE)
      return audit === undefined ? [] : [pageReport(audit)]
    }
    case 'site': {
      const report = await lastCrawl()
      return report === undefined ? [] : [crawlReport(report)]
    }
    case 'compare': {
      const comparison = await idbGet<PageComparison>('results', LAST_COMPARE)
      if (comparison === undefined) return []
      const side = (s: PageComparison['mine']): Report => ({
        kind: 'page',
        url: s.url,
        findings: s.findings,
        notes: [],
      })
      return [side(comparison.mine), side(comparison.theirs)]
    }
  }
}

const MIME: Readonly<Record<ExportFormat, string>> = {
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
}
const EXTENSION: Readonly<Record<ExportFormat, string>> = {
  markdown: 'md',
  json: 'json',
  csv: 'csv',
}

function render(list: readonly Report[], format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return list.map(toMarkdown).join('\n')
    case 'json':
      return list.length === 1
        ? toJson(list[0] as Report)
        : `[${list.map((report) => toJson(report)).join(',')}]`
    case 'csv':
      return toCsv(list)
  }
}

const CSV_COLUMNS = ['url', 'layer', 'group', 'check_id', 'check', 'status', 'severity', 'summary']

// The report lane renders Markdown and JSON only; a spreadsheet wants one row per finding.
function toCsv(list: readonly Report[]): string {
  const row = (cells: readonly string[]) => cells.map(csvCell).join(',')
  const lines = list.flatMap((report) =>
    report.findings.map((finding: Finding) =>
      row([
        finding.evidence.find((e) => e.url !== undefined)?.url ?? report.url,
        finding.layer,
        finding.group,
        finding.checkId,
        check(finding.checkId).title,
        finding.status,
        finding.severity ?? '',
        finding.summary,
      ]),
    ),
  )
  return [row(CSV_COLUMNS), ...lines].join('\r\n') + '\r\n'
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function registerExportHandlers(): void {
  handle('export', async ({ subject, format }): Promise<ExportFile> => {
    const list = await reports(subject)
    if (list.length === 0) throw new Error('Run a check first; there is nothing to export yet.')
    const date = new Date().toISOString().slice(0, 10)
    return {
      filename: `agent-ready-${subject}-${date}.${EXTENSION[format]}`,
      mime: MIME[format],
      text: render(list, format),
    }
  })
}
