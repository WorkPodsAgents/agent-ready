# Agent Ready Website Audit for Hermes Agent

SEO and AI search audits of any public web page, run from Hermes. Agent Ready checks a page the
way search engines, AI answer engines (ChatGPT, Perplexity, Google AI Overviews) and AI agents read
it, says what to fix first, and drafts the fixes. It is free and needs no account or API key.

Made by [WorkPods](https://workpods.ai). Learn more on the
[Agent Ready page](https://workpods.ai/tools/agent-ready).

## Install

```bash
hermes plugins install agent-ready
hermes plugins enable agent-ready
```

Then ask Hermes something like "audit https://example.com/pricing for SEO and AI search" or "can
ChatGPT and Perplexity read my site?".

## What it can do

| Tool                                                                        | What it does                                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `seo_audit_page`                                                            | Audits one page: indexing, title and description, headings, schema markup, links, image alt text and AI readiness    |
| `check_robots_sitemap_llms_txt`                                             | Reads robots.txt with a verdict for each AI crawler, the sitemaps, llms.txt and the agent files under `/.well-known` |
| `check_ai_crawler_access`                                                   | Says whether GPTBot, ClaudeBot, PerplexityBot and others may read one page                                           |
| `check_agent_readiness`                                                     | Checks labelled forms, WebMCP tools, a Markdown version and MCP Registry listings                                    |
| `compare_with_competitor_page`                                              | Lists the checks where your page and a competitor's page differ                                                      |
| `check_local_seo_details`                                                   | Checks a business's name, address and phone, LocalBusiness schema, click-to-call and map                             |
| `start_site_crawl`, `get_site_crawl`                                        | Crawls up to 50 pages for broken links, duplicates, orphan pages and sitemap problems                                |
| `draft_llms_txt`, `draft_robots_txt_for_ai_crawlers`, `draft_schema_markup` | Drafts an llms.txt, robots.txt rules for AI crawlers, or JSON-LD                                                     |
| `request_full_audit`                                                        | Asks WorkPods for a fuller audit by email, only when you ask for one                                                 |

The plugin also adds the `agent-ready-website-audit` skill, which tells Hermes which tool to use
and how to report the results.

The checks are deterministic and run no AI model. They do not cover rankings, keyword volumes,
backlinks or how AI answers mention a brand.

## What to know before you install

- **Network calls.** Every tool call goes to the hosted server at `https://mcp.workpods.ai/mcp`,
  run by WorkPods. The server fetches the public pages you name. Nothing runs on your machine and
  the plugin stores no credentials.
- **What is recorded.** The domain and path checked (never the query string), the tool, which
  checks failed, the app name and a session code that changes daily. No IP address, page text or
  identity is stored. Details are in the
  [privacy policy](https://workpods.ai/privacy#agent-ready-mcp).
- **Report pages.** Each check returns a shareable report link on `mcp.workpods.ai`. Reports are
  not indexed by search engines and are deleted after 30 days.
- **Full audit requests.** `request_full_audit` sends your work email and website to WorkPods.
  It is the only tool that does more than read, so the plugin marks the server `untrusted` and
  Hermes asks before running it.
- **Usage limits.** The free server limits how many checks one address can run, to share it
  fairly.

## Source and support

The plugin is in the [`hermes/`](https://github.com/WorkPodsAgents/agent-ready/tree/main/hermes)
folder of [WorkPodsAgents/agent-ready](https://github.com/WorkPodsAgents/agent-ready), which also
holds the Agent Ready Chrome extension and the local MCP server. Questions go to
[yours@workpods.ai](mailto:yours@workpods.ai) or a
[GitHub issue](https://github.com/WorkPodsAgents/agent-ready/issues).

Licensed under Apache-2.0.
