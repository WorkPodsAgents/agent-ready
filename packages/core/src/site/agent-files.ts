// Reads the files agents use on a site, ported from WorkPods AgentFiles.kt: its llms.txt, its AI
// catalog and the MCP server cards the catalog links to, the MCP server card at its well-known
// path, its A2A agent card (the legacy agent.json only when the current card is absent), the
// legacy ai-plugin.json, its API catalog and its agent skills index. When an MCP server card the
// site serves names an endpoint on the site's own host, that endpoint's OAuth Protected Resource
// Metadata is read too; otherwise it is not read, as the site has no MCP server of its own to
// protect. Each file is kept under the URL asked for; an answer that only stands in for a missing
// file is not found. What a file says is the site's data, never followed as instructions.
import type { Fetcher } from '../io'
import {
  CATALOG_TYPE,
  checkAgentCard,
  checkCatalog,
  checkServerCard,
  serverCardRemotes,
} from './agent-manifests'
import {
  checkApiCatalog,
  checkProtectedResource,
  checkSkillsIndex,
  LINKSET_TYPE,
  protectedResourceReads,
} from './discovery-manifests'
import { fetchFile, mediaType, resolve } from './fetch-file'
import type { FileProblem } from './file-problem'
import { llmsTxtProblems } from './llms-txt'
import { outcomeOf, type FileOutcome } from './outcome'
import { absenceReason, type AbsenceReason, type AgentFileKind } from './soft-absence'

/** One agent file as read. */
export interface AgentFile {
  readonly kind: AgentFileKind
  /** The URL asked for. */
  readonly url: string
  readonly outcome: FileOutcome
  /** The HTTP status; null when no answer came. */
  readonly status: number | null
  /** Why a 2xx answer counts as no file; null otherwise. */
  readonly absence: AbsenceReason | null
  /** How a present file breaks its standard; null when it was not read. */
  readonly problems: readonly FileProblem[] | null
  /**
   * For a catalog that was read: the fields ARD v0.91 requires that its own standard leaves
   * optional. They are shown, never counted in a verdict. Null for other files.
   */
  readonly ard: readonly FileProblem[] | null
  /** For a catalog: every server card it links to was read. Null for other files. */
  readonly complete: boolean | null
  /** Read because the AI catalog links to it. */
  readonly linked: boolean
}

const WELL_KNOWN = '/.well-known'
const CARD_ACCEPT = 'application/mcp-server-card+json, application/json'
const CATALOG_ACCEPT = `${CATALOG_TYPE}, application/json`
const JSON_ACCEPT = 'application/json'
/** Server cards read per catalog; a catalog with more is incomplete. */
const MAX_CARDS = 5

/** The agent files at `origin`, judged against where its home page lands. */
export async function readAgentFiles(
  fetcher: Fetcher,
  origin: string,
  home: string,
): Promise<AgentFile[]> {
  const read: Read = (kind, url, check, accept = '*/*') =>
    readFile(fetcher, kind, url, accept, home, check)
  const remotes: string[] = []
  const cardCheck: Check = (text) => {
    remotes.push(...serverCardRemotes(text))
    return checkServerCard(text)
  }
  const llms = await read('llms_txt', `${origin}/llms.txt`, llmsTxtProblems)
  const catalog = await readCatalog(read, `${origin}${WELL_KNOWN}/ai-catalog.json`, cardCheck)
  remotes.push(...catalog.remotes)
  const cardUrl = `${origin}${WELL_KNOWN}/mcp/server-card.json`
  const card = catalog.files.some((file) => file.url === cardUrl)
    ? []
    : [await read('mcp_server_card', cardUrl, cardCheck, CARD_ACCEPT)]
  const agent = await read('a2a_agent_card', `${origin}${WELL_KNOWN}/agent-card.json`, (text) =>
    checkAgentCard(text, false),
  )
  const legacy =
    agent.outcome === 'not_found'
      ? [
          await read('a2a_agent_card', `${origin}${WELL_KNOWN}/agent.json`, (text) =>
            checkAgentCard(text, true),
          ),
        ]
      : []
  // ai-plugin.json is only told apart from a stand-in here; it has no standard left to check.
  const plugin = await read('ai_plugin', `${origin}${WELL_KNOWN}/ai-plugin.json`, () => [])
  const apis = await read(
    'api_catalog',
    `${origin}${WELL_KNOWN}/api-catalog`,
    checkApiCatalog,
    `${LINKSET_TYPE}, application/json`,
  )
  const skills = await read(
    'agent_skills_index',
    `${origin}${WELL_KNOWN}/agent-skills/index.json`,
    checkSkillsIndex,
    JSON_ACCEPT,
  )
  const protectedResource = await readProtectedResource(read, origin, remotes)
  return [
    llms,
    ...catalog.files,
    ...card,
    agent,
    ...legacy,
    plugin,
    apis,
    skills,
    ...protectedResource,
  ]
}

/** `type`: the answer's media type without parameters; null when it named none. */
type Check = (text: string, type: string | null) => FileProblem[]
type Read = (kind: AgentFileKind, url: string, check: Check, accept?: string) => Promise<AgentFile>

/** The catalog, then the server cards it links to, one level deep. */
async function readCatalog(
  read: Read,
  url: string,
  cardCheck: Check,
): Promise<{ readonly files: AgentFile[]; readonly remotes: readonly string[] }> {
  let linked: readonly string[] = []
  let ard: readonly FileProblem[] = []
  let remotes: readonly string[] = []
  const catalog = await read(
    'ai_catalog',
    url,
    (text) => {
      const checked = checkCatalog(text)
      linked = checked.cards
      ard = checked.ard
      remotes = checked.remotes
      return [...checked.problems]
    },
    CATALOG_ACCEPT,
  )
  const resolved = [...new Set(linked.map((card) => resolve(url, card)))].filter(
    (card): card is string => card !== null,
  )
  const cards: AgentFile[] = []
  for (const card of resolved.slice(0, MAX_CARDS)) {
    const file = await read('mcp_server_card', card, cardCheck, CARD_ACCEPT)
    cards.push({ ...file, linked: true })
  }
  const complete = resolved.length === linked.length && resolved.length <= MAX_CARDS
  const judged = catalog.outcome === 'ok' ? { ...catalog, ard, complete } : catalog
  return { files: [judged, ...cards], remotes }
}

/**
 * The metadata of the first MCP endpoint on the site's own host: at the path RFC 9728 builds from
 * the endpoint, then at the origin when that one is not there. None when no card names such an
 * endpoint.
 */
async function readProtectedResource(
  read: Read,
  origin: string,
  remotes: readonly string[],
): Promise<AgentFile[]> {
  const host = new URL(origin).host
  const endpoint = remotes
    .flatMap((remote) => resolve(`${origin}/`, remote) ?? [])
    .find((url) => /^https?:/.test(url) && new URL(url).host === host)
  if (endpoint === undefined) return []
  const files: AgentFile[] = []
  for (const { url, resources } of protectedResourceReads(endpoint)) {
    const file = await read(
      'oauth_protected_resource',
      url,
      (text) => checkProtectedResource(text, resources),
      JSON_ACCEPT,
    )
    files.push(file)
    if (file.outcome !== 'not_found') break
  }
  return files
}

async function readFile(
  fetcher: Fetcher,
  kind: AgentFileKind,
  url: string,
  accept: string,
  home: string,
  check: Check,
): Promise<AgentFile> {
  const answer = await fetchFile(fetcher, url, accept)
  const outcome = outcomeOf(answer)
  const status = answer.response?.status ?? null
  const base = { kind, url, status, ard: null, complete: null, linked: false }
  if (outcome !== 'ok' || answer.response === null) {
    return { ...base, outcome, absence: null, problems: null }
  }
  const absence = absenceReason(kind, url, answer.url, answer.response, home)
  if (absence !== null) return { ...base, outcome: 'not_found', absence, problems: null }
  const problems = check(answer.response.body, mediaType(answer.response))
  return { ...base, outcome, absence: null, problems }
}
