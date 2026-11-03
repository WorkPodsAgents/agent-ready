// The never-submit rules (AX1). A journey shows how far an agent gets, so it stops before any
// step that would change something for real: an order, a booking, a message, an account.
import type { ActionTarget, BrowseAction } from './types'

export type RefusalClass =
  | 'form_submit'
  | 'final_button'
  | 'sign_in'
  | 'password'
  | 'payment_field'
  | 'enter_key'
  | 'unsafe_navigation'

export interface Refusal {
  readonly class: RefusalClass
  /** One sentence for the result's stopped_at. */
  readonly reason: string
}

const CLICKABLE = new Set(['button', 'menuitem', 'link', 'tab', 'option'])

// Words that make a control final wherever they appear in its name.
const PAYMENT =
  /\b(pay|buy|purchase|place (my |your )?order|complete (my |your )?(order|purchase))\b/i
const SEND = /\b(submit|send)\b/i
const ACCOUNT = /\b(sign ?up|register|create (an |my |your )?account|subscribe)\b/i
const SIGN_IN = /\b(sign ?in|log ?in)\b/i
// Booking and confirming are final as the whole name of a button, such as "Confirm" or "Book now",
// while "Book a demo" on a home page is the way into the task.
const BOOKING = new RegExp(
  '^(book|book now|confirm|confirm (booking|appointment|order|purchase|and pay)|' +
    'schedule|reserve|reserve now|complete booking)$',
  'i',
)

/** The rule an action breaks, or null when it may run. */
export function refusalFor(action: BrowseAction, target: ActionTarget | null): Refusal | null {
  switch (action.kind) {
    case 'navigate':
      return /^https?:\/\//i.test(action.url)
        ? null
        : {
            class: 'unsafe_navigation',
            reason: `Only web pages may be opened, not ${scheme(action.url)}.`,
          }
    case 'scroll':
      return null
    case 'click':
      return target === null ? null : clickRefusal(target)
    case 'type':
      if (/[\r\n]/.test(action.text)) {
        return { class: 'enter_key', reason: 'Typing a line break would press Enter and submit.' }
      }
      return target === null ? null : fieldRefusal(target)
    case 'select':
      return target === null ? null : fieldRefusal(target)
  }
}

function clickRefusal(target: ActionTarget): Refusal | null {
  const name = target.name.trim()
  if (target.submits) {
    const button = name.length > 0 ? `"${name}"` : 'An unnamed button'
    return { class: 'form_submit', reason: `${button} submits a form.` }
  }
  if (SIGN_IN.test(name)) {
    return { class: 'sign_in', reason: `"${name}" starts a sign-in.` }
  }
  if (!CLICKABLE.has(target.role) && !isButtonTag(target)) return null
  const link = target.role === 'link'
  if (PAYMENT.test(name)) return final(name)
  // A link only opens a page, so sending, sign-up and booking words matter on buttons alone.
  if (!link && (SEND.test(name) || ACCOUNT.test(name) || BOOKING.test(name))) return final(name)
  return null
}

function fieldRefusal(target: ActionTarget): Refusal | null {
  const autocomplete = target.autocomplete ?? ''
  if (
    target.type === 'password' ||
    /\b(current-password|new-password|one-time-code)\b/.test(autocomplete)
  ) {
    return { class: 'password', reason: 'Password and sign-in codes are never filled.' }
  }
  if (/\bcc-/.test(autocomplete)) {
    return { class: 'payment_field', reason: 'Payment card fields are never filled.' }
  }
  return null
}

function final(name: string): Refusal {
  return { class: 'final_button', reason: `"${name}" is a final step and is never pressed.` }
}

function isButtonTag(target: ActionTarget): boolean {
  return target.tag === 'button' || (target.tag === 'input' && target.type === 'button')
}

function scheme(url: string): string {
  return url.split(':')[0] ?? url
}
