# @workpods/agent-ready

Local MCP server and CLI for the Agent Ready browser extension: check SEO, AI answer visibility
(GEO), and whether AI agents can use a website (AXO).

## Install the extension

[Install Agent Ready from the Chrome Web Store](https://chromewebstore.google.com/detail/agent-ready-by-workpods/lemechdbpooffhgeidkmefoppjjilanb).

The extension provides rendered-page checks, reads from open AI answer tabs, and agent journeys.
Page, site-file, and crawl checks can also run in Node without the extension.

## Quick start

Requires Node.js 22 or later. Print the installed package version:

```bash
npx -y @workpods/agent-ready --version
```

Check one page and its site files:

```bash
npx -y @workpods/agent-ready check https://example.com --fail-on high
```

The command prints a Markdown report. It exits with code 1 if a check fails or partly fails at
high or critical severity. Checks that need a browser are reported as not applicable. Running
`npx -y @workpods/agent-ready` without a subcommand prints usage and exits with code 2.

## Use from an AI agent

In the extension's **Settings → Agent connection**, enable **Connect to the local bridge when
it runs**. Keep Chrome open while the agent works.

For Claude Code:

```bash
claude mcp add agent-ready -- npx -y @workpods/agent-ready mcp
```

For Cursor (`~/.cursor/mcp.json`) or Claude Desktop (`claude_desktop_config.json`), add this to
the client's MCP settings:

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "npx",
      "args": ["-y", "@workpods/agent-ready", "mcp"]
    }
  }
}
```

The client starts the local server over stdio. See [agent setup](https://github.com/WorkPodsAgents/agent-ready/blob/main/docs/agents-and-skills.md)
for Codex, skills, and Firefox origin configuration.

## What it can do

- **Page and site checks:** audit a page, crawl a site, and inspect robots.txt, sitemaps, llms.txt,
  and agent manifests.
- **Agent visibility:** inspect rendered text, accessible controls, and WebMCP tools; compare two
  pages. Requires the extension.
- **AI answers:** read an answer already open in a supported AI assistant tab and report brand
  mentions and citations. Requires the extension; it does not send a prompt.
- **Research:** find keyword ideas, keyword gaps, backlinks, and link gaps through DataForSEO.
  Requires the extension and your own provider account; usage may incur charges.
- **Journeys:** observe a page and take steps in a scratch tab to test an agent task. Requires the
  extension. Final submissions, purchases, and sign-ins are refused.

No WorkPods account is required. Provider keys stay in the extension; the MCP server returns
results to the agent and does not receive those keys.

## Links

[Agent Ready by WorkPods](https://workpods.ai/tools/agent-ready) ·
[Source code](https://github.com/WorkPodsAgents/agent-ready) ·
[Privacy and permissions](https://github.com/WorkPodsAgents/agent-ready/blob/main/docs/privacy-and-permissions.md) ·
[CLI documentation](https://github.com/WorkPodsAgents/agent-ready/blob/main/docs/command-line.md) ·
[Apache-2.0 license](https://github.com/WorkPodsAgents/agent-ready/blob/main/LICENSE)

Built by [WorkPods](https://workpods.ai). Written by Shefali Munjal. See LICENSE and NOTICE for
licensing and attribution.
