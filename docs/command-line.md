# Command line and CI

The bridge package doubles as a command-line tool. It runs the checks in Node, with no browser
and no extension. Use it to check a page from a terminal, or to fail a build when a deploy breaks
something a search engine or an AI crawler needs.

You need Node 22 or later. `npx` downloads the published package when you first run it.

## Check a page

```bash
npx @workpods/agent-ready check https://example.com/pricing
```

This checks the page and its site files (robots.txt, AI crawler access, sitemaps, llms.txt and
agent manifests) and prints a Markdown report. Add `--json` for the findings as JSON, for a script
or a dashboard.

Without a browser, the checks that need the rendered page come back untested: the raw versus
rendered comparison, LCP and CLS, schema properties and WebMCP tools. The report says so. See
[What runs where](how-checks-work.md#what-runs-where).

## Crawl a site

```bash
npx @workpods/agent-ready crawl https://example.com --limit 100
```

This crawls up to `--limit` pages (200 by default) one at a time, following robots.txt, and prints
the site-wide findings: duplicates, broken links, redirects, orphan and deep pages, sitemap errors,
soft 404s and hreflang. Progress goes to stderr, so you can redirect the report to a file:

```bash
npx @workpods/agent-ready crawl https://example.com > crawl-report.md
```

## Fail a build

`check` exits with a code you can use in CI:

| Exit code | Meaning                                                                   |
| --------- | ------------------------------------------------------------------------- |
| `0`       | No check fails or partly fails at or above the `--fail-on` severity       |
| `1`       | At least one does                                                         |
| `2`       | The command was wrong (an unknown command, a bad option or a missing URL) |

`--fail-on` takes `high` (the default), `medium` or `low`. Critical findings fail the build at
every level. Start with `high`, fix what it finds, then tighten it.

A GitHub Actions job that checks your money pages after each deploy to staging:

```yaml
name: Agent Ready
on:
  deployment_status:
jobs:
  check:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        path: ['/', '/pricing', '/demo']
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: >
          npx -y @workpods/agent-ready check
          "${{ github.event.deployment_status.environment_url }}${{ matrix.path }}"
          --fail-on high
```

The `build-agent-ready-site` skill can write this job for your project and choose the pages.

## Other options

```bash
npx @workpods/agent-ready --version   # print the version
npx @workpods/agent-ready mcp         # start the MCP server (your agent does this for you)
```
