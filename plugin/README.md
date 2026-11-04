# Agent Ready skills

Skills for Claude Code and Codex that audit your site the way search engines, AI answers and AI
agents see it, then help you fix what they find. They drive the Agent Ready tools through a
local MCP server, `npx -y @workpods/agent-ready mcp`, which talks to the Chrome extension
on your machine. There is no account, and nothing is sent to WorkPods. Results are saved as files
under `./agent-ready/` in your project.

## Skills

| Skill                    | What it does                                                                        | Needs                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `site-audit`             | Crawls the site, checks money pages and site files, and writes a prioritised report | Nothing; the extension adds rendered checks                              |
| `fix-plan`               | Turns findings into code changes in your repo and checks each fix                   | Your site's code                                                         |
| `build-agent-ready-site` | Guides a developer building pages, and adds a CI check                              | Nothing                                                                  |
| `keyword-research`       | Maps keywords to the pages that should win them                                     | Your own Search Console MCP server, or a DataForSEO key in the extension |
| `ai-visibility`          | Scores how often AI assistants name or cite you against competitors                 | The extension; a Cloro key for unattended runs                           |
| `competitor-gap`         | Compares your pages, keywords and backlinks with competitors                        | The extension; DataForSEO for keyword and link gaps                      |
| `agent-journeys`         | Tests whether an AI agent can complete your key tasks, never submitting or buying   | The extension                                                            |

Paid data uses your own DataForSEO or Cloro keys, saved in the extension's encrypted vault. The
agent never sees them, and every paid call stays under the monthly cap you set there.

## Install

**Claude Code**

```text
/plugin marketplace add WorkPodsAgents/agent-ready
/plugin install agent-ready@agent-ready
```

**Codex:** copy the server block from [codex/config.example.toml](codex/config.example.toml) into
`~/.codex/config.toml`, and copy `plugin/skills/*` into `~/.codex/skills/`.

Then install the Chrome extension, turn on Agent connection in its settings, and keep Chrome
open while the agent works. [Agents and skills](../docs/agents-and-skills.md) covers Cursor,
Claude Desktop, running the bridge from source before the npm release, every tool and
troubleshooting. Without it, the page, site file and crawl checks still run in Node,
and the skills say which checks were not applicable.

## Develop

`node plugin/scripts/lint-skills.mjs` fails when a skill names a tool the bridge does not expose
(skills write tools as `agent-ready:<tool>`), when a SKILL.md's frontmatter is wrong, or
when a relative link is broken.
