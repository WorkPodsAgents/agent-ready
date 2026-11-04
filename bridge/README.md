# @workpods/agent-ready

Local MCP server and CLI for the Agent Ready extension: SEO, GEO and AI agent checks.

Built by [WorkPods](https://workpods.ai). Requires Node.js 22 or later.

```bash
npx -y @workpods/agent-ready --version
npx -y @workpods/agent-ready mcp
```

Check a page without a browser:

```bash
npx -y @workpods/agent-ready check https://example.com --fail-on high
```

Install the [Chrome extension](https://chromewebstore.google.com/detail/agent-ready-by-workpods/lemechdbpooffhgeidkmefoppjjilanb)
for browser-based checks. Optional provider integrations use your own keys, held by the extension.
The MCP bridge sends results to your agent and does not receive provider keys.

See [setup and Firefox instructions](https://github.com/WorkPodsAgents/agent-ready/blob/main/docs/agents-and-skills.md),
[CLI documentation](https://github.com/WorkPodsAgents/agent-ready/blob/main/docs/command-line.md), and [source code](https://github.com/WorkPodsAgents/agent-ready).

Apache-2.0; see LICENSE and NOTICE. Written by Shefali Munjal.
