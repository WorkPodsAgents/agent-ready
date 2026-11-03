import { describe, expect, it } from 'vitest'
import { refusalFor } from '../../src/journeys/policy'
import type { ActionTarget } from '../../src/journeys/types'

const button = (name: string, extra: Partial<ActionTarget> = {}): ActionTarget => ({
  role: 'button',
  name,
  tag: 'button',
  type: 'button',
  autocomplete: null,
  submits: false,
  ...extra,
})
const link = (name: string): ActionTarget => button(name, { role: 'link', tag: 'a', type: null })
const field = (extra: Partial<ActionTarget>): ActionTarget =>
  button('', { role: 'textbox', tag: 'input', type: 'text', ...extra })

const click = { kind: 'click', ref: 'e1' } as const
const type = (text: string) => ({ kind: 'type', ref: 'e1', text }) as const

describe('the never-submit policy', () => {
  it('refuses a control that submits a form, whatever its name', () => {
    expect(refusalFor(click, button('Next', { submits: true }))?.class).toBe('form_submit')
    expect(refusalFor(click, button('', { submits: true }))?.reason).toBe(
      'An unnamed button submits a form.',
    )
  })

  it.each([
    'Pay now',
    'Buy now',
    'Purchase',
    'Place order',
    'Complete your purchase',
    'Submit',
    'Send message',
    'Sign up',
    'Register',
    'Create an account',
    'Subscribe',
    'Book now',
    'Confirm',
    'Confirm booking',
    'Reserve',
  ])('refuses the final button "%s"', (name) => {
    expect(refusalFor(click, button(name))?.class).toBe('final_button')
  })

  it.each(['Sign in', 'Log in', 'Login', 'Sign in with Google'])(
    'refuses "%s" on a button or a link as a sign-in',
    (name) => {
      expect(refusalFor(click, button(name))?.class).toBe('sign_in')
      expect(refusalFor(click, link(name))?.class).toBe('sign_in')
    },
  )

  it('refuses payment words on a link, which can start a checkout', () => {
    expect(refusalFor(click, link('Buy now'))?.class).toBe('final_button')
  })

  it('lets links into a task through, and buttons that do not finish one', () => {
    for (const name of ['Book a demo', 'Pricing', 'Start free trial', 'Contact sales', 'Sign up']) {
      expect(refusalFor(click, link(name))).toBeNull()
    }
    for (const name of ['Book a demo', 'Next', 'Show plans', 'Accept cookies']) {
      expect(refusalFor(click, button(name))).toBeNull()
    }
  })

  it('never fills a password or a one-time code', () => {
    expect(refusalFor(type('secret'), field({ type: 'password' }))?.class).toBe('password')
    expect(refusalFor(type('123456'), field({ autocomplete: 'one-time-code' }))?.class).toBe(
      'password',
    )
  })

  it('never fills a payment card field', () => {
    const card = field({ autocomplete: 'cc-number' })
    expect(refusalFor(type('4111'), card)?.class).toBe('payment_field')
    expect(
      refusalFor(
        { kind: 'select', ref: 'e1', value: '12' },
        field({ autocomplete: 'cc-exp-month' }),
      )?.class,
    ).toBe('payment_field')
  })

  it('refuses a line break, which would press Enter', () => {
    expect(refusalFor(type('Test\n'), field({}))?.class).toBe('enter_key')
  })

  it('lets a test value into an ordinary field', () => {
    expect(refusalFor(type('test@example.com'), field({ type: 'email' }))).toBeNull()
  })

  it('opens only web pages', () => {
    expect(refusalFor({ kind: 'navigate', url: 'javascript:alert(1)' }, null)?.class).toBe(
      'unsafe_navigation',
    )
    expect(refusalFor({ kind: 'navigate', url: 'https://example.com/pricing' }, null)).toBeNull()
    expect(refusalFor({ kind: 'scroll', direction: 'down' }, null)).toBeNull()
  })
})
