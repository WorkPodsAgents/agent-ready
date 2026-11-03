// `agent-ready mcp`: the stdio MCP server an agent starts. Each tool call goes to the
// extension over the local link; the checks that need no browser run here in Node when the
// extension is not connected, so an agent can still audit a site from a terminal.
import type { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { BRIDGE_PORT, EXTENSION_ORIGIN } from '@open-agent-ready/core/bridge'
import type { ToolArgs, ToolName } from '@open-agent-ready/core/bridge'
import { DEFAULT_LIMIT } from '@open-agent-ready/core/crawl'
import {
  NO_BROWSER_NOTE,
  checkInNode,
  crawlInNode,
  crawlResult,
  siteFilesInNode,
} from './core-adapter'
import { ExtensionLink } from './extension-link'
import { TOOL_DESCRIPTIONS, TOOL_TITLES } from './tool-descriptions'
import { SHAPES } from './tools'

const MINUTE = 60_000

/** How long the extension may take: a crawl or a journey step waits on real pages loading. */
const TIMEOUT_MS: Readonly<Record<ToolName, number>> = {
  audit_page: 2 * MINUTE,
  crawl_site: 30 * MINUTE,
  site_files: MINUTE,
  see_as_agent: 2 * MINUTE,
  compare_pages: 3 * MINUTE,
  read_ai_answer: MINUTE,
  keyword_ideas: 2 * MINUTE,
  keyword_gap: 2 * MINUTE,
  backlinks_summary: 2 * MINUTE,
  link_gap: 2 * MINUTE,
  journey_observe: 2 * MINUTE,
  journey_act: 2 * MINUTE,
}

/** The tools Node can answer alone when no extension is connected. */
type Fallbacks = { readonly [T in ToolName]?: (args: ToolArgs[T]) => Promise<string> }

const FALLBACKS: Fallbacks = {
  audit_page: async (args) => json((await checkInNode(args.url, args.brandName ?? null)).page),
  site_files: async (args) =>
    json({ ...(await siteFilesInNode(args.url)), notes: [NO_BROWSER_NOTE] }),
  crawl_site: async (args) => {
    const limit = args.limit ?? DEFAULT_LIMIT
    return json(crawlResult(await crawlInNode(args.url, limit, args.pinned ?? [], log)))
  },
}

export function createMcpServer(link: ExtensionLink, version: string): McpServer {
  const server = new McpServer({ name: 'agent-ready', version })
  for (const tool of Object.keys(SHAPES) as ToolName[]) register(server, link, tool)
  return server
}

function register<T extends ToolName>(server: McpServer, link: ExtensionLink, tool: T): void {
  // Widened so the SDK's conditional callback type resolves; withoutUndefined restores ToolArgs.
  const inputSchema: z.ZodRawShape = SHAPES[tool]
  server.registerTool(
    tool,
    {
      title: TOOL_TITLES[tool],
      description: TOOL_DESCRIPTIONS[tool],
      inputSchema,
      // Only journey_act changes a page (in a scratch tab); every tool reaches outside sites.
      annotations: { readOnlyHint: tool !== 'journey_act', openWorldHint: true },
    },
    async (parsed) => run(link, tool, withoutUndefined<T>(parsed)),
  )
}

async function run<T extends ToolName>(
  link: ExtensionLink,
  tool: T,
  args: ToolArgs[T],
): Promise<CallToolResult> {
  try {
    const fallback: Fallbacks[T] = FALLBACKS[tool]
    if (!link.connected() && fallback !== undefined) return text(await fallback(args))
    return text(json(await link.call(tool, args, TIMEOUT_MS[tool])))
  } catch (error) {
    // ExtensionNotConnected included: its message tells the user how to connect.
    if (error instanceof Error) return failure(error.message)
    throw error
  }
}

/**
 * The SDK has validated `parsed` against SHAPES[tool], and ShapesMatchProtocol proves those
 * shapes equal ToolArgs once undefined members are dropped, which is what this does.
 */
function withoutUndefined<T extends ToolName>(parsed: object): ToolArgs[T] {
  const entries = Object.entries(parsed).filter(([, value]) => value !== undefined)
  return Object.fromEntries(entries) as ToolArgs[T]
}

function json(value: unknown): string {
  return JSON.stringify(value)
}

function text(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }] }
}

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

/** stdout carries the MCP protocol, so everything else goes to stderr. */
function log(line: string): void {
  process.stderr.write(`agent-ready: ${line}\n`)
}

export async function runMcp(version: string): Promise<void> {
  const link = new ExtensionLink({ port: BRIDGE_PORT, allowedOrigin: EXTENSION_ORIGIN, log })
  const server = createMcpServer(link, version)
  await server.connect(new StdioServerTransport())
  log(`MCP server ready; waiting for the extension on 127.0.0.1:${BRIDGE_PORT}.`)
}
