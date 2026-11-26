// The site-level verdicts on agent files, ported from WorkPods AgentFileChecks.kt. Both files are
// optional: a site without one has nothing to judge, which is not applicable, never a fail.
import type { Evidence, Finding } from '../model'
import type { AgentFile } from './agent-files'
import type { FileProblem } from './file-problem'
import { count, finding } from './finding'

/** llms_txt_invalid: an llms.txt the site serves opens with no H1. */
export function llmsTxtFinding(files: readonly AgentFile[]): Finding {
  const rows = files.filter((f) => f.kind === 'llms_txt')
  const broken = rows.filter(isBroken)
  const verdict = (status: 'pass' | 'fail' | 'not_applicable', summary: string, cited = rows) =>
    finding('llms_txt_invalid', 'geo', 'ai_readiness', status, summary, cited.map(evidence))
  if (broken.length > 0)
    return verdict('fail', 'The llms.txt does not open with an H1 title.', broken)
  if (rows.some(isPresent)) return verdict('pass', 'The llms.txt opens with an H1 title.')
  if (rows.every(isRead)) return verdict('not_applicable', 'The site has no llms.txt.')
  return verdict('not_applicable', 'The llms.txt could not be read.')
}

/**
 * agent_manifest_invalid: an AI catalog, MCP server card, A2A agent card, API catalog, agent skills
 * index or MCP endpoint's OAuth Protected Resource Metadata breaks its standard, a catalog links
 * to a server card that is not there, or the site's only manifest is the legacy ai-plugin.json.
 * Catalog entries without the displayName ARD v0.91 requires are named, never a fail.
 */
export function agentManifestFinding(files: readonly AgentFile[]): Finding {
  const current = files.filter((f) => f.kind !== 'llms_txt' && f.kind !== 'ai_plugin')
  const plugin = files.filter((f) => f.kind === 'ai_plugin')
  const absent = current.every((f) => f.outcome === 'not_found')
  const legacyOnly = absent ? plugin.filter(isPresent) : []
  const broken = current.filter(isBroken)
  const offending = [...new Set([...broken, ...dangling(current), ...legacyOnly])]
  const deciding = absent ? [...current, ...plugin] : current
  const verdict = (
    status: 'pass' | 'fail' | 'not_applicable',
    summary: string,
    cited: AgentFile[],
  ) =>
    finding('agent_manifest_invalid', 'axo', 'ai_readiness', status, summary, cited.map(evidence))
  if (offending.length > 0) {
    const summary =
      broken.length > 0
        ? `${count(broken.length, 'agent manifest')} on the site break their standard.`
        : legacyOnly.length > 0 && offending.length === legacyOnly.length
          ? 'The only agent manifest on the site is the retired ai-plugin.json.'
          : 'The AI catalog links to an MCP server card that is not there.'
    return verdict('fail', summary, offending)
  }
  const unread = deciding.some((f) => !isRead(f)) || current.some((f) => f.complete === false)
  if (unread) return verdict('not_applicable', 'Some agent manifests could not be read.', [])
  if (deciding.every((f) => f.outcome === 'not_found')) {
    return verdict('not_applicable', 'The site publishes no agent manifest.', [])
  }
  const present = current.filter(isPresent)
  const gaps = present.reduce((sum, f) => sum + (f.ard?.length ?? 0), 0)
  const ard =
    gaps === 0
      ? ''
      : ` ${count(gaps, 'AI catalog entry', 'AI catalog entries')} ${gaps === 1 ? 'lacks' : 'lack'}` +
        ' the displayName ARD v0.91 requires; the AI Catalog spec leaves it optional.'
  const summary = `${count(present.length, 'agent manifest')} meet their standard.${ard}`
  return verdict('pass', summary, present)
}

/** A catalog that links to a missing card, with that card. */
function dangling(rows: readonly AgentFile[]): AgentFile[] {
  const missing = rows.filter(
    (f) => f.kind === 'mcp_server_card' && f.linked && f.outcome === 'not_found',
  )
  return missing.length === 0 ? [] : [...rows.filter((f) => f.kind === 'ai_catalog'), ...missing]
}

function isPresent(file: AgentFile): boolean {
  return file.outcome === 'ok'
}

function isBroken(file: AgentFile): boolean {
  return file.outcome === 'ok' && (file.problems?.length ?? 0) > 0
}

/** Read or found absent: it can decide a verdict. */
function isRead(file: AgentFile): boolean {
  return file.outcome === 'ok' || file.outcome === 'not_found'
}

function evidence(file: AgentFile): Evidence {
  const problems = (file.problems ?? []).map(problemText)
  const ard = (file.ard ?? []).map((p) => `ARD v0.91 ${problemText(p)}`)
  const note =
    file.outcome !== 'ok'
      ? `${file.outcome}${file.status === null ? '' : ` (HTTP ${file.status})`}`
      : [...problems, ...ard].join('; ')
  return note === '' ? { url: file.url } : { url: file.url, note }
}

function problemText(problem: FileProblem): string {
  return problem.field === null ? problem.code : `${problem.code}: ${problem.field}`
}
