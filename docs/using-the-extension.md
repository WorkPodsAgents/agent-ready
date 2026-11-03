# Using the extension

The side panel has a header and seven tabs. This guide goes through them in order. Each section
says what the tab is for, what it costs and how to get the most from it.

The screenshots show real results for allbirds.com, taken on 2 November 2026. Allbirds is only an
example; it has no connection with Agent Ready or WorkPods.

## The header

- **Settings** (top right) opens the vault, your keys, spend caps, preferences and the agent
  connection. See [Keys and spending](keys-and-spending.md).
- **Connection chips** show whether DataForSEO, Cloro, a model key and the agent bridge are set up.
  A green dot means ready. Click a chip to go straight to its setting.
- **The score strip** shows the SEO, GEO and AXO scores for the open page. Each is a button: click
  it to see only that layer's checks. [How the checks work](how-checks-work.md) explains the
  numbers.

## This page

<img src="images/this-page.png" width="300" align="right" alt="The This page tab for allbirds.com: SEO 22 of 23, GEO 2 of 4, AXO 1 of 5, and the on-page checklist with Structured data and media and AI readiness open">

The tab you will use most. Click **Check this page** on any page, and **Check again** after you
change something.

**The on-page checklist** groups every check under one of eight headings: Indexing and crawl,
Title and meta, Headings and content, Structured data and media, Links, International, Speed and
AI readiness. A heading with problems opens on its own and says how many to fix. Passed and
untested checks fold away under a line such as "3 passed, 1 untested".

Use the **All / SEO / GEO / AXO** control, or click a score in the header, to narrow the list to one
layer.

<br clear="right">

<img src="images/finding.png" width="300" align="right" alt="An opened finding: Page has no structured data, Low, with the summary The page declares no structured data and a Copy fix button">

Open a failing check to see what was found. Two buttons help you fix it:

- **Show on page** scrolls the page to the element and outlines it, when the problem is on one
  element.
- **Copy fix** copies a prompt for your coding agent: the check, the page, the evidence and what a
  fix must do.

A good habit: fix the high-severity checks first, paste each **Copy fix** prompt into your coding
agent, deploy, then click **Check again** to confirm.

<br clear="right">

<img src="images/axo-checks.png" width="300" align="right" alt="The AXO checks for allbirds.com: unlabelled controls (Medium) and forms not exposed as WebMCP tools (Low) failing, an agent journey passing, two checks untested">

**One layer at a time.** Here is the AXO view for allbirds.com. Two checks fail: some buttons and
fields have no accessible name, and key forms aren't exposed as WebMCP tools. One passes, because an
agent journey on the site found a price. Two are untested, because the page has no schema entity
of a type the check covers and declares no WebMCP tools of its own.

<br clear="right">

<img src="images/see-as-ai.png" width="300" align="right" alt="See as AI: 14,678 words in the raw HTML that AI fetchers read against 14,811 rendered, no JSON-LD on either side, and the opening text of each">

**See as AI** sits below the checklist. On the left is the raw HTML that AI crawlers and answer
engines fetch, without running JavaScript. On the right is the rendered page that people see. Each
side shows its word count, the schema.org types it declares and its opening text. When the left
side has far fewer words, AI answers can't read most of your page, and the checks
`ai_content_requires_js` and `schema_requires_js` say so. On allbirds.com, AI fetchers get 99% of
the words.

**Export** saves the page's findings as Markdown (for a ticket or a pull request), JSON (for
scripts) or CSV (for a spreadsheet).

<br clear="right">

## Site

<img src="images/site-files.png" width="300" align="right" alt="Site files for allbirds.com: robots.txt answered 200, 9 sitemap files list 2,201 pages, a Markdown version, llms.txt found, agent manifests not published, and all 17 tracked AI crawlers allowed">

**Site files** checks the files that tell crawlers and agents about your site:

- **robots.txt:** whether each AI crawler may fetch your home page, grouped by what it does
  (training, search index or fetching for a user), plus any Content-Signal lines. Open the line
  under the list to see every crawler.
- **Sitemaps:** whether they can be read and how many URLs they list.
- **llms.txt and agent manifests:** whether you publish them. These are optional, so a missing
  file is untested rather than a failure.

<br clear="right">

<img src="images/crawl-running.png" width="300" align="right" alt="Site health crawling allbirds.com with a 30-page limit and two money pages, 14 of up to 30 pages done">

**Site health** crawls your site, starting from the open page, your sitemap and the pages you list
under **Money pages** (your pricing, product and sign-up pages, one URL per line). Money pages are
crawled first, whatever the limit. It fetches one page at a time with a pause between them, follows
robots.txt, and stops at the **Page limit** (200 by default). Click **Stop** at any time; you keep
what was crawled.

Chrome asks for permission to read the site when the crawl starts.

<br clear="right">

<img src="images/crawl-report.png" width="300" align="right" alt="The crawl report: 30 pages crawled, 30 with problems, 13 site findings, with pages missing from the sitemap, shared meta descriptions, duplicate text and links to redirects">

When it finishes, the **Crawl report** shows the pages crawled, the pages with problems and the
site-wide findings: duplicate titles and content, broken links, links to redirects, orphan and deep
pages, sitemap errors, soft 404s and hreflang pairs that don't link back. It also says how many
pages robots.txt kept the crawler out of.

<br clear="right">

**Open full report** opens the same results in a browser tab, with a table of every page and the
problems on each. The report is kept until the next crawl.

<img src="images/full-report.png" width="100%" alt="The full site report in a browser tab: site findings by group, then a table of every crawled page with its status, word count and number of problems">

## AI answers

This tab shows what AI assistants say about you and your competitors.

<img src="images/ai-answer.png" width="300" align="right" alt="This answer, read from Perplexity: Allbirds absent, Veja named first, On named second, Rothy's and Hoka absent, with two sources cited">

**This answer** reads the AI answer open in your current tab, on ChatGPT, Gemini, Claude,
Perplexity, Google AI Mode or a Google AI Overview. It lists the brands the answer names, in order,
with the passage around each, and the sites it cites. It reads the answer in your own signed-in
session and changes nothing.

Here Perplexity was asked "What are the best sustainable sneakers?". It named Veja first and On
second, and didn't mention Allbirds.

<br clear="right">

**Prompt panel** is a saved set of 5 to 20 questions a buyer would ask, such as "best wool sneakers
for travel". Fill in:

- **Your brand** and **other names for it** (product names, abbreviations, an old name);
- **Your sites**, so citations of your pages count;
- **Competitors**, one per line: the name, then their sites;
- **Prompts**, one per line.

Click **Save panel**. The panel stays on this device.

<img src="images/prompt-panel-run.png" width="300" align="right" alt="An unattended Cloro run of 15 answers for about $0.19, then the history by prompt and engine, and share of voice: On 42%, Allbirds 31%, Veja 19%, Hoka 8%">

**Run the panel** has two modes:

- **Assist (free):** open the assistant in a tab. For each prompt, click **Fill**: the extension
  types it into the chat box, and you press Enter. It never sends a prompt itself. When the answer
  arrives, it is scored and saved.
- **Unattended (Cloro):** runs every prompt on ChatGPT, Gemini and Google AI Mode through your Cloro
  account. Untick an engine to skip it. The panel shows the number of answers and the most it will
  cost before you start, and the run counts against your Cloro cap.

Each answer is scored for your brand as **Named**, **Cited** or **Absent**. **History** keeps every
answer by prompt and engine, shows your share of voice against each competitor, and exports a CSV.
Run the same panel every week or two to see the trend.

<br clear="right">

## Keywords

<img src="images/autocomplete.png" width="300" align="right" alt="Autocomplete for sustainable sneakers: suggestions including sustainable sneakers men, europe, brands 2026 and veja">

**Free:**

- **Autocomplete:** type a seed term and click **Suggest** to see what Google suggests as people
  type it. Pick a suggestion to add it to your seeds.
- **Results page reader:** open a Google results page in your tab and this card reads the People
  also ask questions, the related searches, the AI Overview (if there is one) and the top 10
  results. Click **This page** or **Compare** on any result to check it or compare it with yours.

<br clear="right">

<img src="images/keyword-ideas.png" width="300" align="right" alt="Keyword ideas from the seeds sustainable sneakers and wool sneakers: 100 ideas of 1,117,802 for $0.024, with volume, KD and intent for each">

**With DataForSEO:**

- **Keyword ideas:** enter seeds and click **Find ideas** for related keywords with US search
  volume, keyword difficulty (KD) and intent. The button shows the cost before you click.
- **Check the top 10:** pick a keyword to see the domains ranking in its top 10 and how strong they
  are. A low KD can hide a results page held by strong domains; when it does, the keyword is marked
  **Harder than KD says**. Check this before you call a keyword easy.

<br clear="right">

## Competitors

<img src="images/compare.png" width="300" align="right" alt="Compare pages: allbirds.com against rothys.com, with facts (words, JSON-LD types, status) and every check side by side, the differences marked">

**Compare pages (free)** puts your page and a competitor's side by side: words in the raw HTML,
the share AI fetchers get, JSON-LD types, status, then every check, with the ones that differ
marked. Use it on the page that outranks yours, or the one an AI answer cites instead of yours.
Export the comparison as Markdown, JSON or CSV.

<br clear="right">

<img src="images/competitors.png" width="300" align="right" alt="Who competes with you for allbirds.com: zappos.com, dickssportinggoods.com, nordstrom.com, adidas.com and more, with shared keywords and average position">

**Who competes with you (DataForSEO)** lists the domains that rank for the same keywords as you,
with the number of keywords you share and their average position. They are often not the brands
you think of: for allbirds.com, the closest are retailers like Zappos and Nordstrom. Click a domain
to add it to the keyword gap.

<br clear="right">

<img src="images/keyword-gap.png" width="300" align="right" alt="Keyword gap against veja-store.com and rothys.com: keywords veja-store.com ranks for that allbirds.com doesn't, with volume, KD and position">

**Keyword gap (DataForSEO)** lists the keywords each competitor ranks for and you don't, with
volume, KD and their position. Each is a candidate for a new page or a better one.

<br clear="right">

## Links

All but the last card use DataForSEO Backlinks, which DataForSEO sells as its own subscription.
If your account doesn't have it, the panel says so.

<img src="images/backlinks.png" width="300" align="right" alt="Backlinks for allbirds.com: domain rank 58, 9,581 referring domains, 98,427 backlinks, 5,996 broken backlinks, spam score 6, then referring domains strongest first">

- **Backlinks:** a summary for your domain: domain rank, referring domains, backlinks, broken
  backlinks and spam score.
- **Referring domains:** the sites that link to you, strongest first, with how many links each
  sends.

<br clear="right">

<img src="images/link-gap.png" width="300" align="right" alt="Link gap against veja-store.com and rothys.com: domains such as marieclaire.be and whowhatwear.com that link to both competitors and not to allbirds.com">

- **Link gap:** domains that link to your competitors and not to you, and which competitors each
  one links to. A domain that links to several of them is the best one to pitch.
- **Broken pages (free):** pages your last crawl found broken. Links pointing at them are wasted;
  redirect each one to the closest live page.

<br clear="right">

## Journeys

<img src="images/journey.png" width="300" align="right" alt="A journey on allbirds.com to find the price of the men's Tree Runner: found it in 2 steps, with the replay of each click and the price, $120">

A journey sends an AI agent to your site with a task, such as "Find the price of the main plan or
service", and records where it gets stuck. It is the most direct test of AXO.

1. Enter the **Start page**.
2. Pick a **Task**, or write your own. Choose the tasks your buyers do: find a price, check
   availability, start a booking, find support.
3. Pick a **Model** and click **Run journey**. The list shows a model for each Anthropic, OpenAI or
   Gemini key you saved in Settings, plus **Chrome built-in model (free)** when your Chrome has
   one. The built-in model is small, so expect it to give up sooner than the others.

The agent works in a background tab for up to 15 steps. It reads the page's accessibility tree and
visible text, as an agent in a browser would. It stops before any form is sent, any order or
booking is confirmed, or any sign-in, so it never changes anything on your site.

<br clear="right">

Each result is one of:

- **Found it:** it found what the task asked for.
- **Reached the final step:** it got as far as the last step and stopped there on purpose. For a
  booking or a purchase, this counts as success.
- **Partial:** it made progress but didn't finish.
- **Blocked:** it couldn't go on, for example because a control had no name or the content needed
  a sign-in.
- **Stopped by the safety rules:** the next step would have sent a form or bought something.

Open **Replay** under a result to see every step and the page it was on. The result also feeds the
AXO score on This page: the agent journeys check (AX1) fails when a task ends partial or blocked.
The journey in the screenshot ran through the bridge tools, the way a coding agent runs one. That
needs no model key, because the calling agent is the model. See
[Agents and skills](agents-and-skills.md).
