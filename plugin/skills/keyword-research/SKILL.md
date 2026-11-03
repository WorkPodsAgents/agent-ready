---
name: keyword-research
description: Research the keywords a site should target and map each to the page that should win it, using the user's own Search Console MCP server when connected and DataForSEO through the Agent Ready extension. Writes a topic and page map to ./agent-ready/. Use when asked for keyword research, content gaps, striking-distance keywords, cannibalisation or a content plan.
---

# Keyword research

A good map says, for each keyword worth winning, which page should win it: an existing page, a
new page, or nobody yet with the reason. It is one list, never a page per keyword.

**Connections.** At least one of:

- **Search Console:** the user's own Search Console MCP server, if one is connected. Any tool
  that returns search analytics rows (query, page, clicks, impressions, position) will do; ask
  the user which property to read. It gives what the site already earns.
- **DataForSEO:** the user's key saved in the extension, used through
  `agent-ready:keyword_ideas`. It gives demand the site does not yet reach. Each call
  costs money: say how many calls you plan and get a yes first.

With neither, stop: say that Search Console needs its own MCP server and DataForSEO needs a key
in the extension's settings. Never invent volumes. With only one, do the steps it allows and
name the rest as not measured.

Save under `./agent-ready/keyword-research/<yyyy-mm-dd>/`. Read
[references/search-console.md](references/search-console.md) before step 2.

## Steps

1. **Scope.** Ask for the site, its market and language, what it sells, and its money pages.
   Draft up to 20 seed terms from the offerings and write relevance rules once: the words a
   relevant keyword contains and the off-topic words to drop. Save `seeds.json`.
2. **What the site earns (Search Console).** Read the last 3 full months of query and page
   rows, compared with the 3 before. Find striking-distance queries, CTR gaps, decaying pages
   and cannibalisation as the reference defines them. Save `search-console.json`. Look for
   Google core updates in the window before blaming content for a drop.
3. **Demand (DataForSEO).** Call `agent-ready:keyword_ideas` with the seeds, the market
   and a limit the user agreed. Drop rows that break the relevance rules and every competitor
   brand name. Save `ideas.json`.
4. **Check before calling a term easy.** A low difficulty score can hide strong sites ranking
   in the top 10. Use the top-10 domain strength each row carries; when it is missing, call the
   term unknown, never easy.
5. **Cluster.** Group terms by intent first, then by whether the same pages rank for them. Two
   terms answered by the same results can usually share one page; confirm by reading what each
   searcher wants.
6. **Map.** For each cluster pick its target: an existing page (say why it should win), a new
   page (with a short brief: audience, the task they came to do, the format that wins the
   results, the facts to include, links in and out), or no target with the reason. Order by
   value: money terms first, then the largest demand the site can realistically win, then
   striking distance.
7. **Report.** Write `map.md` and `map.csv` (cluster, terms, volume, difficulty, top-10
   strength, target page, action, reason). Quote each volume with its market; never add
   volumes across markets.
