// The words an agent reads before it calls a tool. Agents never see output schemas, so each
// description also says what comes back and what an absent or null value means.
import type { ToolName } from '@open-agent-ready/core/bridge'

const FINDINGS =
  'Each finding has checkId (a WorkPods check id), layer (seo, geo, axo), group, status (pass, ' +
  'partial, fail or not_applicable), severity (critical, high, medium or low on a fail or ' +
  'partial, null otherwise), a one-sentence summary and evidence (selector, url, value, note).'

const PAID =
  "It spends from the user's own DataForSEO account inside the extension, within the monthly " +
  'cap set there; a call over the cap is refused with an error saying so, and a cached answer ' +
  'from the last 7 days costs nothing. The agent never sees the key.'

export const TOOL_TITLES: Readonly<Record<ToolName, string>> = {
  audit_page: 'Check a page',
  crawl_site: 'Crawl a site',
  site_files: 'Check site files',
  see_as_agent: 'See a page as an agent',
  compare_pages: 'Compare two pages',
  read_ai_answer: 'Read an AI answer',
  keyword_ideas: 'Keyword ideas',
  keyword_gap: 'Keyword gap',
  backlinks_summary: 'Backlinks summary',
  link_gap: 'Link gap',
  journey_observe: 'Observe an agent journey',
  journey_act: 'Act in an agent journey',
}

export const TOOL_DESCRIPTIONS: Readonly<Record<ToolName, string>> = {
  audit_page:
    'Runs every on-page SEO, GEO and AXO check on one URL: title and meta, headings, canonical, ' +
    'robots directives, hreflang, structured data, links, speed, and whether AI crawlers can ' +
    'read the page without JavaScript. Use it to check a page or to confirm a fix. With the ' +
    'Chrome extension connected it also compares the raw HTML with the rendered page and ' +
    'measures LCP and CLS; without it, those checks come back not_applicable and a note says ' +
    'so. Returns url (the final URL after redirects), status (its HTTP status), findings, and ' +
    `notes on what could not be checked. ${FINDINGS}`,
  crawl_site:
    'Crawls a site politely (robots.txt honoured, one request at a time) from the start URL, ' +
    'its sitemap and any pinned pages, then runs the cross-page checks: duplicate titles and ' +
    'content, broken links, links to redirects, orphan and deep pages, sitemap errors, soft ' +
    '404s and hreflang return links. Use it for a whole-site health check; use audit_page for ' +
    'one page. It can take several minutes. Returns startUrl; stop (complete, limit, stopped or ' +
    'error); pages, each with url, status, title, wordCount and its findings; findings, one ' +
    'site-wide roll-up per cross-page check saying how many pages it fired on; and notes on ' +
    `what was left out. ${FINDINGS}`,
  site_files:
    "Checks the site's robots.txt, sitemaps, llms.txt and agent manifests, and gives a " +
    'robots.txt verdict for each AI crawler with its role (training, search_index or ' +
    'user_fetch). A missing optional file such as llms.txt is not_applicable, never a failure. ' +
    'Returns origin; facts (robots.txt status, Content-Signal lines, aiCrawlers each with ' +
    'allowed true or false for the home page, the agent files found, and the Markdown version); ' +
    `sitemap (the files read and the URLs listed); and findings. ${FINDINGS}`,
  see_as_agent:
    'Shows a page the way an AI agent reads it: the raw HTML a crawler without JavaScript gets, ' +
    'the rendered page text, the accessibility tree (roles and accessible names of controls) ' +
    'and the WebMCP tools the page registers. Use it to explain why an agent or AI answer ' +
    'misses content, or before a journey. Needs the Chrome extension. A null part could not ' +
    'be read, and an empty tool list means the page registers no WebMCP tools.',
  compare_pages:
    "Runs every page check on the user's page and a competitor's page and lines them up check " +
    'by check, with word count, headings, schema types, JavaScript dependence, AI crawler ' +
    'access, llms.txt and agent manifests for each. Use it to see what a rival page that ' +
    'outranks or out-cites the user does differently. Needs the Chrome extension. Returns one ' +
    'row per check with both statuses, and the facts side by side.',
  read_ai_answer:
    'Reads an AI answer open in a Chrome tab (ChatGPT, Gemini, Claude, Perplexity, Google AI ' +
    "Mode or AI Overviews) in the user's own session. Use it after the user has asked a buyer " +
    'question there; it never types or sends a prompt. Returns the engine, the prompt as shown, ' +
    'the brands named in order with the passage naming each, the cited URLs, and for the brand ' +
    'and each competitor a verdict: cited (a citation points at its domains), named, or absent. ' +
    'Needs the Chrome extension and an open answer tab; an error says when the tab holds no ' +
    'answer it can read.',
  keyword_ideas:
    'Finds keyword ideas from seed terms with search volume, keyword difficulty, intent and ' +
    'the strength of the domains in the top 10 results, so a low difficulty score with strong ' +
    `domains ranking is visible. Use it for keyword research in one market. ${PAID} Returns ` +
    'rows of keyword, volume, difficulty, intent and top-10 domain strength; a null figure is ' +
    'unknown to DataForSEO, never zero.',
  keyword_gap:
    "Lists keywords the competitors rank for in one market that the user's domain does not, " +
    'or ranks far below them for. Use it to find content the site is missing. ' +
    `${PAID} Returns rows of keyword, volume, the user's position (null when it does not rank) ` +
    "and each competitor's position.",
  backlinks_summary:
    'Summarises the backlinks of a domain or page: referring domains, domain rank, new and ' +
    `lost links, and top anchors. Use it to size a site's authority. ${PAID} If the user's ` +
    'DataForSEO plan has no Backlinks access, an error says so.',
  link_gap:
    "Lists domains that link to the competitors but not to the user's domain, ranked by " +
    `domain rank. Use it to find outreach targets. ${PAID} Returns rows of the linking domain, ` +
    'its rank, and which competitors it links to.',
  journey_observe:
    'Starts or looks at an agent journey: the extension opens the start URL in a scratch tab ' +
    'and returns what an agent can see there, the page URL, title, visible text and the ' +
    'controls with a ref each, plus the WebMCP tools the page registers. Start with url and ' +
    'task; continue with journeyId after each journey_act. Use it to test whether an AI agent ' +
    'can complete a key task on the site. Needs the Chrome extension. Returns journeyId, the ' +
    'step count (a journey ends at 15 steps) and the observation.',
  journey_act:
    'Takes one step in a journey started with journey_observe and returns the new observation. ' +
    'The extension refuses to submit a form, press a final button (pay, book, send, sign up, ' +
    'place an order) or sign in; a refused step comes back with stopped_by_policy and the ' +
    'reason. End every journey with a finish action. Needs the Chrome extension.',
}
