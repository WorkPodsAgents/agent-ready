// The command line: `check` and `crawl` run the core checks in Node for terminals and CI, and
// `mcp` starts the server an agent talks to.
import { parseArgs } from 'node:util'
import type { Finding, Severity } from '@open-agent-ready/core'
import { DEFAULT_LIMIT } from '@open-agent-ready/core/crawl'
import { isProblem, toJson, toMarkdown } from '@open-agent-ready/core/report'
import type { PageReport } from '@open-agent-ready/core/report'
import packageJson from '../package.json' with { type: 'json' }
import { checkInNode, crawlInNode, siteReport } from './core-adapter'
import { runMcp } from './mcp'

const USAGE = `Usage:
  agent-ready check <url> [--json] [--fail-on high|medium|low]
      Check one page and its site files. Exits 1 when a check fails or partly fails at or
      above --fail-on (default high), so it can gate a CI job.
  agent-ready crawl <url> [--limit N]
      Crawl up to N pages (default ${DEFAULT_LIMIT}) and report site-wide problems.
  agent-ready mcp
      Start the MCP server for Claude Code, Codex and other agents.
`

/** At or above a --fail-on level: critical counts under every level. */
const FAIL_ON: Readonly<Record<string, readonly Severity[]>> = {
  high: ['critical', 'high'],
  medium: ['critical', 'high', 'medium'],
  low: ['critical', 'high', 'medium', 'low'],
}

/** Runs one command and returns its exit code: 0 clean, 1 failing checks, 2 a usage error. */
export async function main(argv: readonly string[], out: (text: string) => void): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: false,
    options: {
      json: { type: 'boolean' },
      'fail-on': { type: 'string' },
      limit: { type: 'string' },
      version: { type: 'boolean' },
    },
  })
  const [command, url] = positionals
  if (values.version === true) return done(out, `${packageJson.version}\n`, 0)
  if (command === 'mcp') {
    await runMcp(packageJson.version)
    return 0
  }
  if (command === 'check' && url !== undefined) {
    const failOn = FAIL_ON[String(values['fail-on'] ?? 'high')]
    if (failOn === undefined) return done(out, USAGE, 2)
    return check(url, values.json === true, failOn, out)
  }
  if (command === 'crawl' && url !== undefined) {
    const limit = Number(values.limit ?? DEFAULT_LIMIT)
    if (!Number.isInteger(limit) || limit < 1) return done(out, USAGE, 2)
    const report = await crawlInNode(url, limit, [], (line) => process.stderr.write(`${line}\n`))
    out(toMarkdown(siteReport(report, limit)))
    return 0
  }
  return done(out, USAGE, 2)
}

async function check(
  url: string,
  json: boolean,
  failOn: readonly Severity[],
  out: (text: string) => void,
): Promise<number> {
  const { page, site } = await checkInNode(url, null)
  const report: PageReport = {
    kind: 'page',
    url: page.url,
    findings: [...page.findings, ...site.findings],
    notes: page.notes,
  }
  out(json ? toJson(report) : toMarkdown(report))
  return report.findings.some((finding) => failsAt(finding, failOn)) ? 1 : 0
}

function failsAt(finding: Finding, failOn: readonly Severity[]): boolean {
  return isProblem(finding) && finding.severity !== null && failOn.includes(finding.severity)
}

function done(out: (text: string) => void, text: string, code: number): number {
  out(text)
  return code
}
