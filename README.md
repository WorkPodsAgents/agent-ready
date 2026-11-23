# Agent Ready: free SEO Chrome extension for AI search and AI agents

Agent Ready is a free, open-source SEO Chrome extension that checks any page for search engines,
AI answers and AI agents, and tells you what to fix. It is for marketers, SEOs and developers who
want to know whether Google, ChatGPT, Perplexity and AI agents can read and use their site.

<img src="store/images/1-this-page.png" alt="Agent Ready's side panel on allbirds.com: SEO 22 of 23, GEO 2 of 4 and AXO 1 of 5, above an on-page checklist grouped into sections">

It comes with a local MCP server, a CLI for CI and a set of skills for coding agents. It checks
any page for three things:

- **SEO:** can search engines crawl, index and understand the page?
- **GEO:** can AI answer engines such as ChatGPT, Gemini and Perplexity reach, read and cite it?
- **AXO:** can an AI agent use the site? Can it name the controls, call the forms as tools and
  finish a task like finding a price?

It needs no account, sends nothing to us and has no telemetry. The checks come from the audits
[WorkPods.ai](https://workpods.ai) runs for its clients, with the same ids, severities and wording.

<p align="center">
  <img src="store/images/2-ai-answers.png" width="49%" alt="One Perplexity answer read for Allbirds: Veja named first and On second, Allbirds absent, and the two sources the answer cited">
  <img src="store/images/3-journey.png" width="49%" alt="An agent journey on allbirds.com that found the price of the men's Tree Runner in two steps">
  <img src="store/images/4-keywords.png" width="49%" alt="Keyword ideas from the seeds sustainable sneakers and wool sneakers, with volume, difficulty and intent">
  <img src="store/images/5-agents.png" width="49%" alt="The agent connection setting, connected to the local bridge that Claude, Codex and Cursor use">
</p>
<p align="center"><sub>Real results for allbirds.com, used as an example only. More in <a href="docs/using-the-extension.md">Using the extension</a>.</sub></p>

## Get started

Install [Agent Ready from the Chrome Web Store](https://chromewebstore.google.com/detail/agent-ready-by-workpods/lemechdbpooffhgeidkmefoppjjilanb).

The [npm bridge package](https://www.npmjs.com/package/@workpods/agent-ready) provides agent and
CLI commands. See [Agents and skills](docs/agents-and-skills.md) for setup.
[TESTING.md](TESTING.md) covers unpacked builds for development and release testing.

1. [Install the extension](https://chromewebstore.google.com/detail/agent-ready-by-workpods/lemechdbpooffhgeidkmefoppjjilanb),
   open its side panel and click **Check this page**:
   [Getting started](docs/getting-started.md).
2. Learn what each tab does: [Using the extension](docs/using-the-extension.md).
3. Connect your coding agent and add the skills: [Agents and skills](docs/agents-and-skills.md).

```bash
# Give Claude Code the Agent Ready tools, then turn on Agent connection in the extension's settings
claude mcp add agent-ready -- npx -y @workpods/agent-ready mcp

# Check a page from a terminal or a CI job, with no browser
npx @workpods/agent-ready check https://example.com --fail-on high
```

## What it does

**Free, with no keys:**

- Checks the page you are on. Each check passes, fails, partly passes or is untested, and a
  failure carries a severity. **Show on page** marks the element, and **Copy fix** copies a prompt
  for your coding agent.
- **See as AI** puts the raw HTML that AI crawlers read next to the page people see: word counts,
  schema types and text. If your copy only appears after JavaScript runs, it shows here.
- Reads robots.txt, sitemaps, llms.txt and agent manifests, and says which AI crawlers may fetch
  the site. It works as an llms.txt checker (does the file follow llmstxt.org?) and an AI crawler
  checker for GPTBot, ClaudeBot, PerplexityBot and the other bots it tracks.
- Crawls up to 200 pages, one at a time and within robots.txt, to find broken links, duplicates,
  orphan pages, soft 404s and hreflang errors.
- Compares your page with a competitor's, check by check.
- Reads an AI answer open in your tab (ChatGPT, Gemini, Claude, Perplexity, Google AI Mode or an
  AI Overview) and marks which brands it names and which sites it cites.
- Runs a panel of buyer prompts in **Assist** mode: the extension types each prompt, you press
  Enter, and it scores the answer.
- Sends an AI agent through a task on your site, such as finding a price. The agent stops before a
  form is sent, an order is placed or anyone signs in.

**With your own keys**, kept encrypted on your device under a monthly cap you set:

- **DataForSEO:** keyword ideas with volume and difficulty, competitor discovery, keyword gap,
  backlinks and link gap.
- **Cloro:** prompt panels that run unattended on ChatGPT, Gemini and Google AI Mode.
- **Anthropic, OpenAI or Gemini:** the model that runs agent journeys from the panel. Your coding
  agent can run journeys instead, through the bridge.

**From your coding agent:** Claude Code, Codex, Cursor and other MCP clients can run every check
through the local bridge. The skills turn the results into an audit report, and then into code
changes in your repository.

## Questions

**Is Agent Ready free?**
Yes. The extension, the MCP bridge, the CLI and the skills are free and open source under
Apache-2.0, with no account. Paid data, such as keyword volumes, backlinks and unattended prompt
panels, uses your own DataForSEO, Cloro or model keys, encrypted on your device under a monthly
cap you set.

**Can it check my llms.txt and robots.txt for AI crawlers?**
Yes. The Site files view reads robots.txt and says whether each tracked AI crawler, such as
GPTBot, ClaudeBot and PerplexityBot, may fetch your pages. It checks that llms.txt opens with the
H1 title llmstxt.org asks for, and lists your sitemaps and agent manifests under /.well-known.

**How does it check AI visibility?**
Open an answer in ChatGPT, Gemini, Claude, Perplexity, Google AI Mode or an AI Overview, and Agent
Ready marks which brands it names and which sites it cites. You can also run a panel of buyer
prompts and score each answer. With a Cloro key, panels run unattended.

**Can I use it from Claude Code, Codex or Cursor?**
Yes. The npm package `@workpods/agent-ready` is a local SEO MCP server. Add it to your agent, turn
on Agent connection in the extension, and the agent can run every check, write an audit report
with the skills and then make the fixes in your repository.

**Does it send my data anywhere?**
No. The extension never calls a WorkPods.ai server and has no telemetry. Results, keys and history
stay on your device. Paid features call the provider whose key you added, and nothing else. See
[Privacy and permissions](docs/privacy-and-permissions.md) for each permission and why it is asked.

## Agent Ready in other tools

The same checks, run from the hosted Agent Ready server, are available where you already work:

- [Agent Ready for VS Code](https://github.com/WorkPodsAgents/agent-ready-vscode): SEO audits in
  VS Code and Copilot agent mode
- [Agent Ready for JetBrains IDEs](https://github.com/WorkPodsAgents/agent-ready-jetbrains): SEO
  audits in IntelliJ IDEA, WebStorm and PyCharm
- [Agent Ready for n8n](https://github.com/WorkPodsAgents/n8n-nodes-agent-ready): SEO audits in
  n8n workflows and AI agents
- [Agent Ready for EmDash](https://github.com/WorkPodsAgents/emdash-agent-ready): content SEO
  checks inside the EmDash CMS admin

For Google Business Profiles and Google Maps rankings, use
[Local SEO](https://github.com/WorkPodsAgents/local-seo), the sister extension.

## Documentation

| Guide                                                      | Read it to                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)                 | Install the extension and run your first check                               |
| [Using the extension](docs/using-the-extension.md)         | Work through each tab, from This page to Journeys                            |
| [How the checks work](docs/how-checks-work.md)             | Read a score, a status and a severity, and know what "untested" means        |
| [Keys and spending](docs/keys-and-spending.md)             | Set up the vault, add DataForSEO, Cloro or a model key, and cap what you pay |
| [Agents and skills](docs/agents-and-skills.md)             | Connect Claude Code, Codex or Cursor, and use the seven skills               |
| [Command line and CI](docs/command-line.md)                | Check pages from a terminal and fail a build when a page regresses           |
| [Privacy and permissions](docs/privacy-and-permissions.md) | See what is stored, what leaves your device and why each permission is asked |

## How it is built

```text
packages/core/    The checks, in plain TypeScript. They take a parsed page, headers and files and
                  never call Chrome, so the extension, the bridge and the CLI share them.
extension/        The Chrome extension (Manifest V3, WXT and React): side panel, service worker,
                  content scripts and the full-page crawl report.
bridge/           The npm package @workpods/agent-ready: the MCP server and the CLI.
plugin/           The skills for Claude Code and Codex.
vendor/workpods/  The check registry, theme and fonts, copied from WorkPods.ai.
```

To work on it you need Node 22 or later:

```bash
npm install
npm run build -w extension   # then Load unpacked: extension/.output/chrome-mv3
npm run check                # format, typecheck, tests, skills lint and build
```

Read [AGENTS.md](AGENTS.md) before you change anything; it has the rules every change follows. Two
matter most. The extension never calls a WorkPods.ai server. API keys are decrypted only in the
service worker and never reach a page, the bridge, a log or an export. Tests replay recorded
provider responses and never call a paid API.

Found a bug or a verdict you think is wrong? Open an issue with the page URL, what you expected
and a screenshot of the panel. Never paste an API key into an issue.

## Firefox builds

Firefox desktop 140 or later is supported by the Firefox package. Build it with
`npm run zip:firefox -w extension`. Chrome builds use a side panel and service worker; Firefox uses
its sidebar and a background event page. Firefox stores private records in extension-origin
IndexedDB and asks for data-consent permissions at install time. Optional cloud providers still
require your own keys. Chrome's built-in model is unavailable in Firefox.

The local MCP bridge needs the exact Firefox installation origin from Settings; see
[Firefox bridge setup](docs/agents-and-skills.md#firefox-bridge-origin).

## Licence

Apache-2.0, copyright WorkPods. Written by Shefali Munjal. The WorkPods name and logo are trademarks
and are not covered by the licence; see [NOTICE](NOTICE).

If you use Agent Ready in a commercial product or service, please credit "Agent Ready by WorkPods"
publicly, with a link to this repository. The licence does not require it, but it is how we can
keep the tool free.

## By WorkPods.ai

Agent Ready is built by [WorkPods.ai](https://workpods.ai), an AI SEO agency. Read more on the
[Agent Ready SEO and AI visibility checker](https://workpods.ai/tools/agent-ready) page, or see
[all free WorkPods.ai SEO tools](https://workpods.ai/tools).
