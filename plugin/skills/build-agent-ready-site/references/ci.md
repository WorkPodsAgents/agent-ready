# CI check

The CLI runs the page checks and the site file checks without a browser and exits 1 when a
check fails at or above `--fail-on` (default `high`).

```bash
npx -y @workpods/agent-ready check https://preview.example.com/ --fail-on high
npx -y @workpods/agent-ready check https://preview.example.com/pricing --json > report.json
```

GitHub Actions, after the preview deploy step:

```yaml
- name: Agent-ready check
  run: |
    for path in / /pricing /contact; do
      npx -y @workpods/agent-ready check "$PREVIEW_URL$path" --fail-on high
    done
```

Start with `--fail-on high` so existing low-severity issues do not block every build, then
tighten it as they are fixed. Checks that compare raw and rendered HTML, and Core Web Vitals,
need the Chrome extension and are not applicable in CI.
