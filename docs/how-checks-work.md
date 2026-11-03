# How the checks work

Agent Ready runs the same checks WorkPods uses in its client audits. Each has a stable id (such as
`missing_title`, `ai_content_requires_js` or `AX2`), a layer, a group and a default severity. They
are listed in `vendor/workpods/contracts/check-registry.json`.

## Three layers

| Layer   | The question it answers                                                                     | Examples                                                                                         |
| ------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **SEO** | Can search engines crawl, index and understand this page?                                   | Status code, canonical, noindex, title and meta description, H1, hreflang, alt text, LCP and CLS |
| **GEO** | Can AI answer engines reach, read and cite this page?                                       | AI crawlers blocked in robots.txt, copy or schema that needs JavaScript, answer-first structure  |
| **AXO** | Can an AI agent use this site: name its controls, call its forms as tools and finish tasks? | Unlabelled buttons and fields, forms without WebMCP tools, missing schema properties, journeys   |

A fourth layer, **ACO** (agentic commerce: agents that buy for people), is shown as "Later". It
has no checks yet.

## Four statuses

| Status       | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| **Pass**     | The page does what the check asks.                                                       |
| **Fail**     | It doesn't. The finding says what was found, with the element, URL or value as evidence. |
| **Partial**  | Part of it holds: some images lack alt text, or one AI crawler of five is blocked.       |
| **Untested** | There was nothing to judge, or it couldn't be measured here. The finding says which.     |

"Untested" is never a failure. It covers three different cases, and the summary tells you which
one you have:

- **Nothing to judge.** The page declares no hreflang, so the hreflang checks have nothing to
  test.
- **Optional and absent.** You don't publish llms.txt or an agent manifest. These are worth adding,
  but not having them is not an error.
- **Not run yet.** The agent journeys check (AX1) stays untested until you run a journey on the
  site. Speed checks are untested when the page was checked without a browser, from the command
  line.

## Severity

Every fail and partial carries a severity. Fix them in this order.

| Severity     | What it usually means                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **Critical** | Nothing works for this audience at all. Rare: for example, an agent was blocked on every task you gave it. |
| **High**     | A major loss: the page doesn't answer 200, has no title, is noindex, or is blocked by robots.txt.          |
| **Medium**   | A real weakness that costs you: copy that needs JavaScript, or buttons with no accessible name.            |
| **Low**      | Worth fixing when you are in the code anyway.                                                              |

Each check has a default severity in the registry. Some checks raise or lower it from the evidence.
For example, a form with no WebMCP tool is low, and medium when it is a search form or has two or
more fields.

## Reading a score

Each layer's score is the checks that passed over all its checks, such as **19 of 23**. Under it,
the panel says how many fail and how many are untested, for example "3 failing · 1 untested". A
partial counts as failing.

The bar under the score has three parts: green for passed, red for failing and striped for
untested. A layer where most checks couldn't be judged looks mostly striped, so a score never
looks complete when it isn't.

Click a layer's score to list only its checks.

## The AXO checks

AXO is the newest layer and the one people ask about most.

| Check                                      | What it looks at                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AX1:** key tasks an agent can't complete | Your agent journeys on this site. Fails when a task ends partial or blocked, and is critical when every task is blocked.                               |
| **AX2:** key forms with no WebMCP tool     | Forms an agent would fill in (not sign-in forms). A form with a `toolname` attribute is exposed as a WebMCP tool, so an agent can call it in one step. |
| Unlabelled controls                        | Buttons, links and fields without an accessible name, which an agent can't tell apart.                                                                 |
| Schema properties                          | Schema.org entities missing the properties recommended for their type, which agents and answer engines rely on.                                        |
| WebMCP tool descriptions                   | Tools the page registers whose names or descriptions would mislead an agent. Untested when the page registers none.                                    |

## What runs where

Most checks run anywhere. A few need a real browser:

| Needs                              | Checks                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Nothing (the page and its headers) | Status, redirects, title and meta, headings, canonical, robots, hreflang, schema, links |
| The site's files                   | robots.txt, AI crawler access, sitemaps, llms.txt, agent manifests                      |
| A browser (the extension)          | Raw versus rendered comparison, LCP and CLS, schema properties, WebMCP tools            |
| A browser and a model              | Agent journeys (AX1)                                                                    |

So the command line and an agent without the extension give you most of the checks, and mark the
rest untested with a note saying why.
