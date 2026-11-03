// Acts on the scratch tab from inside the page. The session's policy has already decided each
// action may run; this only finds the element by its ref and does what a visitor would do.
import { accessibleName } from '@open-agent-ready/core/page'
import { elementFor, roleOf } from './observe'
import type { ActionTarget, BrowseAction } from './types'

/** In-page steps: navigation is the tab's, not the page's. */
export type PageAction = Exclude<BrowseAction, { kind: 'navigate' }>

/** What the policy needs to know about the element behind `ref`, read from the live DOM. */
export function describeRef(doc: Document, ref: string): ActionTarget | null {
  const element = elementFor(doc, ref)
  if (element === null) return null
  const tag = element.localName
  const type = element.getAttribute('type')?.toLowerCase() ?? null
  const form = (element as HTMLButtonElement).form ?? element.closest('form')
  const submits =
    form !== null &&
    ((tag === 'button' && (type ?? 'submit') === 'submit') ||
      (tag === 'input' && (type === 'submit' || type === 'image')))
  return {
    role: roleOf(element) ?? '',
    name: accessibleName(element),
    tag,
    type,
    autocomplete: element.getAttribute('autocomplete')?.toLowerCase() ?? null,
    submits,
  }
}

export function performOn(doc: Document, action: PageAction): void {
  if (action.kind === 'scroll') {
    const view = doc.defaultView
    view?.scrollBy(0, (action.direction === 'down' ? 1 : -1) * view.innerHeight * 0.8)
    return
  }
  const element = elementFor(doc, action.ref)
  if (element === null) throw new Error(`No element has ref ${action.ref} on this page.`)
  switch (action.kind) {
    case 'click':
      click(element as HTMLElement)
      break
    case 'type':
      type(element as HTMLElement, action.text)
      break
    case 'select':
      select(element, action.value)
      break
  }
}

// A link that opens a new tab would leave the scratch tab behind, so it opens in place.
function click(element: HTMLElement): void {
  if (element.localName === 'a') element.removeAttribute('target')
  element.scrollIntoView?.({ block: 'center' })
  element.click()
}

function type(element: HTMLElement, text: string): void {
  element.focus()
  const setter = valueSetter(element)
  if (setter !== null) setter.call(element, text)
  else if (element.isContentEditable || element.hasAttribute('contenteditable')) {
    element.textContent = text
  } else throw new Error('This element does not take text.')
  changed(element)
}

function select(element: Element, value: string): void {
  if (element.localName !== 'select') throw new Error('This element is not a list of options.')
  const list = element as HTMLSelectElement
  const option = Array.from(list.options).find(
    (o) => o.value === value || o.textContent?.trim() === value,
  )
  if (option === undefined) throw new Error(`This element has no option ${JSON.stringify(value)}.`)
  option.selected = true
  changed(element)
}

/**
 * The native value setter. Frameworks such as React watch the element's own `value`, so a field
 * filled through the native setter reads as typed by a person.
 */
function valueSetter(element: Element): ((this: Element, value: string) => void) | null {
  if (element.localName !== 'input' && element.localName !== 'textarea') return null
  for (let proto = Object.getPrototypeOf(element); proto !== null;) {
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter !== undefined) return setter
    proto = Object.getPrototypeOf(proto)
  }
  return null
}

function changed(element: Element): void {
  const view = element.ownerDocument.defaultView
  const EventType = view?.Event ?? Event
  element.dispatchEvent(new EventType('input', { bubbles: true }))
  element.dispatchEvent(new EventType('change', { bubbles: true }))
}
