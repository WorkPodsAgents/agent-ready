# AGENTS.md: Agent Ready

Agent Ready is an open-source browser extension, local MCP bridge and skills plugin that show a
site the way search engines, AI answers and AI agents see it. WorkPods builds it and gives it away.
`CLAUDE.md` is a symlink to this file.

```text
packages/core/    Pure TypeScript checks. Takes parsed pages, headers and files; never calls Chrome.
extension/        The MV3 extension (WXT + React): side panel, service worker, content scripts.
vendor/workpods/  Files copied from the WorkPods platform by scripts/sync-from-workpods.mjs.
scripts/          Repo tooling: the WorkPods sync and the team build release.
```

## Rules

- **Standalone.** Nothing here calls a WorkPods server or needs a WorkPods account, and nothing sends
  telemetry. Data stays on the user's device; paid providers are reached with the user's own keys.
- **Same checks as WorkPods.** A check uses the id, severity and rubric of the WorkPods registry in
  `vendor/workpods/contracts/`. Never edit `vendor/`; change WorkPods, then run
  `npm run sync:workpods -- <workpods checkout>`.
- **Secrets.** API keys are decrypted only in the service worker, and never reach a page, a content
  script, the MCP bridge, a log or an export.
- **Least privilege.** Ask for a permission when a feature needs it, and only for the sites it needs.
- **Justify it or delete it.** Every file, dependency and line names the behaviour or invariant it
  serves.
- **Tests are behaviour-driven.** Given a page or a recorded provider response, when a check runs,
  then this verdict. Providers are never called live in tests.
- **Code shape.** Lines are at most 100 characters. A comment says why, never what.
- **Theme.** Colours, type and spacing come from the WorkPods tokens; no raw colour outside
  `vendor/`.

## Verification

```bash
npm run check    # format, typecheck, tests and build
```

Publishing (a public repository, the Chrome Web Store, npm) needs the owner's explicit go.
