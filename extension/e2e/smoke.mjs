// End-to-end run of the built extension in Chromium. Always: open the side panel page at the
// panel's width and check every tab renders with no page error. With --staging: check
// staging.workpods.ai for real (This page, Site files, a 10-page crawl and an agent journey that
// must reach the free audit form and never send it). Branded Chrome ignores --load-extension,
// so this needs a Chromium build.
//
//   node extension/e2e/smoke.mjs [screenshot-dir] [--staging]
//
// --staging loads the `wxt build --mode e2e` output, whose manifest grants the test sites up
// front, since a headless browser cannot answer a permission prompt.
// PLAYWRIGHT_CORE and CHROMIUM override where playwright-core and the browser are found.
import { mkdtempSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const staging = args.includes('--staging')
const shots = args.find((arg) => !arg.startsWith('--')) ?? null
const here = dirname(fileURLToPath(import.meta.url))
const extension = resolve(here, staging ? '../.output/chrome-mv3-e2e' : '../.output/chrome-mv3')
const { chromium } = await import(
  process.env.PLAYWRIGHT_CORE ??
    '/home/shefali/.npm/_npx/2334a3ea0ef73d73/node_modules/playwright-core/index.mjs'
)
const executablePath =
  process.env.CHROMIUM ?? '/home/shefali/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
const TABS = ['This page', 'Site', 'AI answers', 'Keywords', 'Competitors', 'Links', 'Journeys']
const STAGING = 'https://staging.workpods.ai/'
// Staging is noindex and its robots.txt shuts out every crawler on purpose, AI crawlers included,
// and its canonicals name workpods.ai.
const EXPECTED_FAILS = ['noindex', 'blocked_by_robots', 'canonical_mismatch', 'ai_crawler_blocked']
const JOURNEY_TASK = 'Find how to request a free audit'
const MINUTE = 60_000

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'oar-')), {
  executablePath,
  headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
const failures = []
const notes = []
const saved = []
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  const id = new URL(worker.url()).host
  if (shots !== null) await mkdir(shots, { recursive: true })
  const shoot = async (page, file, options = {}) => {
    if (shots === null) return
    await page.screenshot({ path: join(shots, file), ...options })
    saved.push(file)
  }

  const panel = await context.newPage()
  panel.on('pageerror', (error) => failures.push(`page error: ${error.message}`))
  panel.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console error: ${message.text()}`)
  })
  await panel.setViewportSize({ width: 400, height: 900 })
  await panel.goto(`chrome-extension://${id}/sidepanel.html`)
  await panel.getByText('Agent Ready', { exact: true }).waitFor()
  await panel.getByRole('list', { name: 'Connections' }).waitFor()
  for (const [index, name] of TABS.entries()) {
    await panel.getByRole('tab', { name, exact: true }).click()
    const tabPanel = panel.getByRole('tabpanel', { name, exact: true })
    await tabPanel.waitFor()
    if ((await tabPanel.innerText()).trim() === '') failures.push(`${name}: the tab is empty`)
    const slug = name.toLowerCase().replaceAll(' ', '-')
    await shoot(panel, `${String(index + 1).padStart(2, '0')}-${slug}.png`, { fullPage: true })
  }
  await panel.getByRole('button', { name: 'DataForSEO: not set up. Open settings.' }).click()
  const settings = panel.getByRole('region', { name: 'Settings' })
  await settings.getByRole('heading', { name: 'Provider keys' }).waitFor()
  await shoot(panel, '08-settings.png', { fullPage: true })
  const report = await context.newPage()
  report.on('pageerror', (error) => failures.push(`report error: ${error.message}`))
  await report.goto(`chrome-extension://${id}/report.html`)
  await report.getByRole('heading', { name: 'Site report' }).waitFor()
  await shoot(report, '09-report.png')

  if (staging) await checkStaging(panel, report, shoot)
} catch (error) {
  failures.push(error instanceof Error ? error.message.split('\n')[0] : String(error))
} finally {
  await context.close()
}
for (const note of notes) console.log(note)
if (shots !== null) console.log(`screenshots in ${shots}: ${saved.join(', ')}`)
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(
  staging
    ? 'e2e: the panel renders, and staging checks, crawls and journeys as expected'
    : 'smoke: the side panel and the report tab render',
)

/** Sends one message to the service worker from the panel page, as the panel does. */
function ask(panel, type, payload) {
  return panel.evaluate(
    async ([type, payload]) => {
      const reply = await chrome.runtime.sendMessage({ type, payload })
      if (!reply.ok) throw new Error(reply.error)
      return reply.result
    },
    [type, payload],
  )
}

async function checkStaging(panel, report, shoot) {
  // The panel works on the active tab, so the site opens last and stays in front while the
  // panel page is driven in the background, as a side panel beside it would be.
  const site = await context.newPage()
  await site.goto(STAGING, { waitUntil: 'load' })
  await site.bringToFront()

  await panel.getByRole('tab', { name: 'This page', exact: true }).click()
  await panel.getByRole('button', { name: 'Check this page' }).click()
  await panel.getByText('On-page checklist').waitFor({ timeout: 2 * MINUTE })
  const audit = await ask(panel, 'page:last', {})
  const ids = (status) => audit.findings.filter((f) => f.status === status).map((f) => f.checkId)
  for (const checkId of EXPECTED_FAILS) {
    if (!ids('fail').includes(checkId)) failures.push(`This page: ${checkId} did not fail`)
  }
  notes.push(`This page: ${audit.findings.length} findings; fail: ${ids('fail').join(' ')}`)
  for (const f of audit.findings) {
    if ((f.status === 'fail' || f.status === 'partial') && !EXPECTED_FAILS.includes(f.checkId)) {
      notes.push(`  unexpected ${f.status} ${f.checkId}: ${f.summary}`)
    }
  }
  await shoot(panel, '10-this-page-top.png')
  await panel.mouse.move(200, 450)
  await panel.mouse.wheel(0, 500)
  await panel.waitForTimeout(300)
  await shoot(panel, '11-this-page-scrolled.png')
  await panel
    .getByText('See as AI', { exact: true })
    .evaluate((heading) => heading.scrollIntoView({ block: 'start' }))
  await shoot(panel, '12-see-as-ai.png')
  // A score cell narrows the checklist to its layer, every section open.
  await panel.getByRole('button', { name: /^AXO: / }).click()
  await panel.getByRole('heading', { name: 'AXO checks' }).waitFor()
  await panel.evaluate(() => window.scrollTo(0, 0))
  await shoot(panel, '16-axo-checks.png', { fullPage: true })
  await panel.getByRole('button', { name: 'All', exact: true }).click()

  await panel.getByRole('tab', { name: 'Site', exact: true }).click()
  await panel.getByRole('button', { name: 'Check files' }).click()
  await panel.getByRole('button', { name: 'Check again' }).waitFor({ timeout: MINUTE })
  await panel.getByLabel('Page limit').fill('10')
  await panel.getByRole('button', { name: 'Start crawl' }).click()
  await panel.getByRole('button', { name: 'Stop' }).waitFor()
  await panel.getByRole('button', { name: 'Start crawl' }).waitFor({ timeout: 5 * MINUTE })
  const crawl = await ask(panel, 'site:last', {})
  if (crawl === null) failures.push('Site: the crawl left no report')
  else {
    const crawled = crawl.pages.length
    notes.push(`Crawl: ${crawled} pages, ${crawl.blockedByRobots} kept out by robots.txt`)
    if (crawled > 10) failures.push(`Site: the crawl passed its limit with ${crawled} pages`)
    // Staging's robots.txt disallows everything, so the polite crawl may fetch nothing; then
    // the report must say why instead of showing an empty crawl.
    if (crawled === 0 && crawl.blockedByRobots === 0) failures.push('Site: an empty crawl')
    if (crawl.blockedByRobots > 0) {
      await panel.getByText('robots.txt keeps the crawler out of').waitFor()
    }
    for (const f of crawl.findings) {
      if (f.status === 'fail' || f.status === 'partial') {
        notes.push(`  site ${f.status} ${f.checkId}: ${f.summary}`)
      }
    }
  }
  await shoot(panel, '13-site.png', { fullPage: true })
  await report.reload()
  await report.getByText('Site findings').waitFor()
  await shoot(report, '14-site-report.png', { fullPage: true })

  const journey = await scriptedJourney(panel)
  notes.push(`Journey: ${journey.outcome}; ${journey.stoppedAt}; WebMCP ${journey.webMcpApi}`)
  for (const step of journey.trail) {
    const said = step.refused ?? step.error ?? ''
    notes.push(`  ${step.index}. ${step.action.kind} ${step.target ?? ''} ${said}`)
  }
  if (journey.outcome !== 'stopped_by_policy' || !/submits a form/.test(journey.stoppedAt ?? '')) {
    failures.push(`Journey: expected a stop before the form was sent, got ${journey.outcome}`)
  }
  if (!journey.trail.some((step) => step.action.kind === 'type' && step.error === null)) {
    failures.push('Journey: never filled a field of the form')
  }
  await panel.getByRole('tab', { name: 'Journeys', exact: true }).click()
  await panel.getByText(JOURNEY_TASK).first().waitFor()
  await shoot(panel, '15-journeys.png', { fullPage: true })
}

/**
 * A fake model with a fixed plan, driving the journey through the bridge tools as a calling
 * agent does: follow the free audit link, fill the form with test data, then press its button,
 * which the policy must refuse.
 */
async function scriptedJourney(panel) {
  let view = await ask(panel, 'tool:journey_observe', { url: STAGING, task: JOURNEY_TASK })
  const journeyId = view.journeyId
  const act = async (action) => {
    view = await ask(panel, 'tool:journey_act', { journeyId, action })
    return view
  }
  const elements = () => view.observation.elements
  const link = elements().find((e) => e.role === 'link' && /free audit/i.test(e.name))
  if (link === undefined) {
    return (await act({ kind: 'finish', outcome: 'blocked', note: 'No free audit link.' })).result
  }
  await act({ kind: 'click', ref: link.ref })
  if (view.done) return view.result
  const fields = elements().filter((e) => e.role === 'textbox' && !e.disabled)
  for (const field of fields) {
    await act({ kind: 'type', ref: field.ref, text: testValue(field.name) })
    if (view.done) return view.result
  }
  // The form's own button is the first one after its last field.
  const lastField = elements().findIndex((e) => e.ref === fields.at(-1)?.ref)
  const button = elements()
    .slice(lastField + 1)
    .find((e) => e.role === 'button')
  if (button === undefined) {
    return (await act({ kind: 'finish', outcome: 'partial', note: 'No form button.' })).result
  }
  await act({ kind: 'click', ref: button.ref })
  if (view.done) return view.result
  return (await act({ kind: 'finish', outcome: 'partial', note: 'The button ran.' })).result
}

function testValue(fieldName) {
  if (/mail/i.test(fieldName)) return 'test@example.com'
  if (/site|url|domain|web/i.test(fieldName)) return 'https://example.com'
  return 'Test Person'
}
