// The MCP tools the bridge forwards, as `tool:<name>` router handlers. Each runs inside the
// extension with the user's own permissions, keys and spend cap; results carry data only, never
// a credential.
import type { ToolArgs, ToolName } from '@open-agent-ready/core/bridge'
import { comparePages, auditUrl, seeAsAgent } from './page'
import { dataForSeo, market, paid } from './paid'
import { registerHandler } from './router'
import { crawlSite, DEFAULT_CRAWL_LIMIT, siteFiles } from './site'
import { readSettings } from './settings'

function tool<T extends ToolName>(name: T, run: (args: ToolArgs[T]) => Promise<unknown>): void {
  registerHandler(`tool:${name}`, (args, sender) => {
    // Only the bridge link calls tools, and it calls the router directly with no sender.
    if (sender !== null) throw new Error(`tool:${name} is only open to the agent bridge`)
    if (typeof args !== 'object' || args === null) throw new Error(`${name} needs its arguments`)
    // The bridge validated the arguments against the same ToolArgs schema before sending them.
    return run(args as ToolArgs[T])
  })
}

export function registerToolHandlers(): void {
  tool('audit_page', async ({ url, brandName }) =>
    auditUrl(url, brandName ?? (await readSettings()).brandName),
  )
  tool('crawl_site', ({ url, limit, pinned }) =>
    crawlSite(url, limit ?? DEFAULT_CRAWL_LIMIT, pinned ?? []),
  )
  tool('site_files', ({ url }) => siteFiles(url))
  tool('see_as_agent', ({ url }) => seeAsAgent(url))
  tool('compare_pages', ({ url, competitorUrl }) => comparePages(url, competitorUrl))
  tool('keyword_ideas', ({ seeds, location, language, limit }) =>
    paid(() => dataForSeo.keywordIdeas(seeds, market(location, language), limit)),
  )
  tool('keyword_gap', ({ domain, competitors, location, limit }) =>
    paid(() => dataForSeo.keywordGap(domain, competitors, market(location), limit)),
  )
  tool('backlinks_summary', ({ target }) => paid(() => dataForSeo.backlinksSummary(target)))
  tool('link_gap', ({ domain, competitors, limit }) =>
    paid(() => dataForSeo.linkGap(domain, competitors, limit)),
  )
}
