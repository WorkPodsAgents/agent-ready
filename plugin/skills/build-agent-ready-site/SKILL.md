---
name: build-agent-ready-site
description: Build or change a website so search engines, AI answers and AI agents can find, read and use it, and add a CI check that keeps it that way. Use when a developer is building a site, adding pages or templates, choosing rendering, writing robots.txt, sitemaps, llms.txt or structured data, or asks to make a site agent ready.
---

# Build an agent-ready site

For developers, while they write the code. Apply what fits the change at hand; do not rewrite
working code to match a checklist. [references/checklist.md](references/checklist.md) has the
details per area, and [references/ci.md](references/ci.md) the CI setup.

**Connections.** None. `agent-ready:audit_page` and `agent-ready:site_files` check the
running site; the CLI does the same in a terminal or CI.

## Steps

1. **Learn the stack.** Find the framework, how pages render (server, static, client only), and
   where the head, metadata, robots.txt and sitemap come from.
2. **Rendering first.** Main content, links and JSON-LD must be in the HTML the server sends.
   AI crawlers that fetch pages for answers run no JavaScript. A client-only page is the most
   expensive problem to fix later; raise it before anything else.
3. **Apply the checklist** for the areas the change touches: metadata, headings and content,
   structured data, links, crawl files, international, speed, agent use.
4. **Check it.** Run the site locally and call `agent-ready:audit_page` on each new or
   changed template and `agent-ready:site_files` on the origin. Fix what fails before
   calling the work done.
5. **Keep it.** Offer the CI check from the reference so a later change cannot break it
   silently.

Never invent facts for metadata, schema or llms.txt. Take them from the site or leave a
`<placeholder>` for the owner.
