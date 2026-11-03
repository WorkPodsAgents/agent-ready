import type { PageCommand, RenderedPage } from '../src/shared/offscreen'

// Injected into the user's tab only when they check it. It reads the live page and marks the
// element a finding points at; it never sees a secret.

const INSTALLED = Symbol.for('open-agent-ready.page')
const HIGHLIGHT_ID = 'open-agent-ready-highlight'
/** Layout shifts closer together than this belong to one session window (the CLS definition). */
const SESSION_GAP_MS = 1_000
const SESSION_MAX_MS = 5_000

export default defineContentScript({
  registration: 'runtime',
  main() {
    const scope = globalThis as { [INSTALLED]?: true }
    // Every command injects the script first, so a second injection must not listen twice.
    if (scope[INSTALLED]) return
    scope[INSTALLED] = true
    const vitals = watchVitals()
    browser.runtime.onMessage.addListener((message: PageCommand, _sender, sendResponse) => {
      if (message.target !== 'page') return undefined
      if (message.op === 'snapshot') {
        // Buffered performance entries arrive on the next task, so wait one before reading.
        setTimeout(() => sendResponse(snapshot(vitals)), 0)
        return true
      }
      sendResponse(highlight(message.selector))
      return undefined
    })
  },
})

interface VitalsWatch {
  lcpMs: number | null
  cls: number | null
}

function watchVitals(): VitalsWatch {
  const watch: VitalsWatch = { lcpMs: null, cls: null }
  observe('largest-contentful-paint', (entry) => {
    watch.lcpMs = Math.round(entry.startTime)
  })
  let session = { value: 0, start: 0, last: 0 }
  observe('layout-shift', (entry) => {
    const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
    if (shift.hadRecentInput) return
    const t = shift.startTime
    const sameSession = t - session.last < SESSION_GAP_MS && t - session.start < SESSION_MAX_MS
    session = sameSession
      ? { value: session.value + shift.value, start: session.start, last: t }
      : { value: shift.value, start: t, last: t }
    watch.cls = Math.max(watch.cls ?? 0, Number(session.value.toFixed(4)))
  })
  // A page with no shifts at all has a CLS of zero once anything has been measured.
  if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) watch.cls = 0
  return watch
}

function observe(type: string, onEntry: (entry: PerformanceEntry) => void): void {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) return
  new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
    type,
    buffered: true,
  })
}

function snapshot(vitals: VitalsWatch): RenderedPage {
  clearHighlight()
  return {
    html: `<!doctype html>\n${document.documentElement.outerHTML}`,
    vitals: { lcpMs: vitals.lcpMs, cls: vitals.cls },
  }
}

/** Outlines the element in the system highlight colour, which every page's palette leaves alone. */
function highlight(selector: string): boolean {
  clearHighlight()
  const element = document.querySelector(selector)
  if (element === null) return false
  element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const box = element.getBoundingClientRect()
  const mark = document.createElement('div')
  mark.id = HIGHLIGHT_ID
  Object.assign(mark.style, {
    position: 'absolute',
    top: `${box.top + window.scrollY - 4}px`,
    left: `${box.left + window.scrollX - 4}px`,
    width: `${box.width + 8}px`,
    height: `${box.height + 8}px`,
    outline: '3px solid Highlight',
    background: 'color-mix(in srgb, Highlight 15%, transparent)',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '2147483647',
  })
  document.body.append(mark)
  setTimeout(clearHighlight, 4_000)
  return true
}

function clearHighlight(): void {
  document.getElementById(HIGHLIGHT_ID)?.remove()
}
