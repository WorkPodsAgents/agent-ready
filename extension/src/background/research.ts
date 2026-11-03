// Keyword, competitor and backlink research: free autocomplete, and DataForSEO with the user's
// own account under the monthly cap.
import { dataForSeo, estimate, market, paid } from './paid'
import { handle } from './handle'
import { requireHostAccess } from './host-access'

export const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search?client=firefox&q='

/** Google autocomplete for a seed term. Its answer is `[seed, [suggestion, ...]]`. */
export async function suggestions(seed: string): Promise<string[]> {
  await requireHostAccess(SUGGEST_URL)
  const response = await fetch(SUGGEST_URL + encodeURIComponent(seed), { credentials: 'omit' })
  if (!response.ok) throw new Error(`Autocomplete answered ${response.status}.`)
  const body: unknown = await response.json()
  const list = Array.isArray(body) ? body[1] : null
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []
}

export function registerResearchHandlers(): void {
  handle('keywords:suggest', ({ seed }) => suggestions(seed))
  handle('estimate', async (request) => estimate(request))
  handle('keywords:ideas', ({ seeds, limit }) =>
    paid(() => dataForSeo.keywordIdeas(seeds, market(), limit)),
  )
  handle('keywords:view', ({ keyword }) => paid(() => dataForSeo.keywordView(keyword, market())))
  handle('competitors:discover', ({ domain, limit }) =>
    paid(() => dataForSeo.competitorsDomain(domain, market(), limit)),
  )
  handle('competitors:gap', ({ domain, competitors, limit }) =>
    paid(() => dataForSeo.keywordGap(domain, competitors, market(), limit)),
  )
  handle('links:summary', ({ target }) => paid(() => dataForSeo.backlinksSummary(target)))
  handle('links:referring', ({ target, limit }) =>
    paid(() => dataForSeo.referringDomains(target, limit)),
  )
  handle('links:gap', ({ domain, competitors, limit }) =>
    paid(() => dataForSeo.linkGap(domain, competitors, limit)),
  )
}
