---
name: fix-plan
description: Turn Agent Ready findings into code changes in the user's own codebase, apply them with the user's agreement, and check each fix by running the check again. Use after a site audit, when asked to fix SEO, GEO or AI agent problems, or when the user pastes a "Copy fix" prompt from the extension.
---

# Fix plan

Fix problems at their source (the template, component, route or config that produces them) so
every page built from it is fixed at once. Read [references/fixes.md](references/fixes.md) for
the usual fix per check.

**Connections.** None. You need the site's source code in the working directory and a way to run
it (a local dev server or a preview deploy). `agent-ready:audit_page` checks a fix; the CLI
does the same: `npx -y @workpods/agent-ready check <url>`.

Save under `./agent-ready/fix-plan/<yyyy-mm-dd>/`.

## Steps

1. **Collect findings.** Use the latest `./agent-ready/site-audit/*/findings.json`, a
   pasted "Copy fix" prompt, or run `agent-ready:audit_page` on the page the user names.
   Keep only `fail` and `partial` findings.
2. **Plan.** Group findings by cause, find the code behind each (search the codebase for the
   template, the head or metadata component, the robots or sitemap route), and write `plan.md`:
   one item per cause with the files to change, the change, the pages it fixes and how to
   verify. Order: what keeps money pages out of search or AI answers first, then what wastes
   crawl or links, then the rest. Show the plan and wait for the user's go.
3. **Fix.** Make one item's change at a time. Take names, prices and contact details from the
   site itself; where the site does not state a fact, write a `<placeholder>` and tell the user
   to fill it. Never change what an item does not need, and keep titles and headings that
   already rank.
4. **Verify.** Run the site locally or on a preview, then call `agent-ready:audit_page`
   (or the CLI `check`) on an affected page. A fix is done when its check no longer fails. For
   crawl findings (broken links, duplicates, orphans), rerun `agent-ready:crawl_site` on
   the preview or explain why only production can show it.
5. **Record.** Update `plan.md` with each item's status and the check result that proves it.

Never publish, deploy or merge without the user's explicit go.
