// Reads the scratch tab the way agent browsers do: the interactive elements, each with a ref,
// role and accessible name, plus the visible text. It runs inside the page, so a control with no
// name here is a control an agent cannot find.
import { accessibleName } from '@open-agent-ready/core/page'
import type { Observation, ObservedElement } from './types'

/** Enough for any real page's controls while keeping one step's prompt small. */
export const ELEMENT_LIMIT = 200
/** The page text an agent reads per step (AX1's bounded reads). */
export const TEXT_LIMIT = 20_000
/** The attribute that keeps an element's ref for the life of the page. */
export const REF_ATTRIBUTE = 'data-oar-ref'

export type PageReading = Omit<Observation, 'webMcp'>

/** The last ref number handed out on this page; refs live in the page's DOM. */
export interface RefCounter {
  last: number
}

const INTERACTIVE = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
])

const CANDIDATES = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]',
  '[role]',
].join(', ')

/** Fields whose value an agent reads; a password's is never read. */
const VALUE_TYPES = new Set(['text', 'email', 'search', 'tel', 'url', 'number', 'date'])

export function readPage(doc: Document, refs: RefCounter): PageReading {
  const elements: ObservedElement[] = []
  let truncated = false
  for (const element of Array.from(doc.querySelectorAll(CANDIDATES))) {
    const role = roleOf(element)
    if (role === null || !isVisible(element)) continue
    if (elements.length === ELEMENT_LIMIT) {
      truncated = true
      break
    }
    elements.push({
      ref: refFor(element, refs),
      role,
      name: accessibleName(element),
      value: valueOf(element),
      disabled: isDisabled(element),
    })
  }
  const text = visibleText(doc)
  const cut = text.length > TEXT_LIMIT
  return {
    url: doc.URL,
    title: doc.title,
    elements,
    elementsTruncated: truncated,
    text: cut ? text.slice(0, TEXT_LIMIT) : text,
    textFullLength: cut ? text.length : null,
  }
}

/** The element a ref names, or null when the page no longer has it. */
export function elementFor(doc: Document, ref: string): Element | null {
  if (!/^e\d+$/.test(ref)) return null
  return doc.querySelector(`[${REF_ATTRIBUTE}="${ref}"]`)
}

/** The role agent browsers give the element: its own role attribute, else its tag's role. */
export function roleOf(element: Element): string | null {
  const explicit = (element.getAttribute('role') ?? '').trim().split(/\s+/)[0] ?? ''
  if (INTERACTIVE.has(explicit)) return explicit
  switch (element.localName) {
    case 'a':
      return element.hasAttribute('href') ? 'link' : null
    case 'button':
    case 'summary':
      return 'button'
    case 'select':
      return isMultiple(element) ? 'listbox' : 'combobox'
    case 'textarea':
      return 'textbox'
    case 'input':
      return inputRole(inputType(element))
    default:
      return isEditable(element) ? 'textbox' : null
  }
}

function inputRole(type: string): string | null {
  switch (type) {
    case 'hidden':
      return null
    case 'checkbox':
    case 'radio':
      return type
    case 'range':
      return 'slider'
    case 'number':
      return 'spinbutton'
    case 'search':
      return 'searchbox'
    case 'button':
    case 'submit':
    case 'reset':
    case 'image':
    case 'file':
      return 'button'
    default:
      return 'textbox'
  }
}

function inputType(input: Element): string {
  return (input.getAttribute('type') ?? 'text').trim().toLowerCase()
}

function isMultiple(select: Element): boolean {
  return select.hasAttribute('multiple')
}

function isEditable(element: Element): boolean {
  const editable = element.getAttribute('contenteditable')
  return editable !== null && editable !== 'false'
}

function refFor(element: Element, refs: RefCounter): string {
  const kept = element.getAttribute(REF_ATTRIBUTE)
  if (kept !== null) return kept
  refs.last += 1
  const ref = `e${refs.last}`
  element.setAttribute(REF_ATTRIBUTE, ref)
  return ref
}

function isVisible(element: Element): boolean {
  for (let at: Element | null = element; at !== null; at = at.parentElement) {
    if (at.hasAttribute('hidden') || at.hasAttribute('inert')) return false
    if (at.getAttribute('aria-hidden') === 'true') return false
  }
  // Layout exists only in a live page; a parsed document has none to check.
  const live = element as Element & { checkVisibility?: () => boolean }
  return live.checkVisibility === undefined || live.checkVisibility()
}

function valueOf(element: Element): string | null {
  let value = ''
  if (element.localName === 'select') {
    const options = Array.from((element as HTMLSelectElement).options)
    // A single-choice list with nothing marked shows its first option, as browsers do.
    const chosen = options.find((o) => o.selected) ?? (isMultiple(element) ? null : options[0])
    value = chosen?.textContent?.trim() ?? ''
  } else if (element.localName === 'textarea') {
    value = (element as HTMLTextAreaElement).value
  } else if (element.localName === 'input' && VALUE_TYPES.has(inputType(element))) {
    value = (element as HTMLInputElement).value
  }
  return value === '' ? null : value
}

function isDisabled(element: Element): boolean {
  return (
    (element as HTMLButtonElement).disabled === true ||
    element.getAttribute('aria-disabled') === 'true'
  )
}

/** What a visitor sees as text; a parsed document without layout gives its text content. */
function visibleText(doc: Document): string {
  const body = doc.body as HTMLElement | null
  if (body === null) return ''
  return typeof body.innerText === 'string' ? body.innerText : (body.textContent ?? '')
}
