import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { answerCall, type InPageCall } from '../../src/journeys/in-page'
import { ELEMENT_LIMIT, TEXT_LIMIT, type PageReading } from '../../src/journeys/observe'
import type { ActionTarget } from '../../src/journeys/types'

const PAGE = `<!doctype html><html><head><title>Acme Running</title></head><body>
  <h1>Plans</h1>
  <a href="/pricing">  Pricing
    page </a>
  <button><svg></svg></button>
  <label for="email">Email</label><input id="email" type="email" value="test@example.com">
  <input type="password" aria-label="Password" value="hunter2">
  <input type="hidden" name="token" value="x">
  <div hidden><button>Hidden</button></div>
  <button disabled>Off</button>
  <div role="tab" aria-selected="true">Monthly</div>
  <select aria-label="Plan"><option value="pro">Pro</option><option value="team">Team</option></select>
  <form><button>Request a free audit</button></form>
</body></html>`

function page(html = PAGE) {
  const { document } = parseHTML(html)
  const refs = { last: 0 }
  const ask = (call: InPageCall) => {
    const reply = answerCall(document, refs, call)
    if (!reply.ok) throw new Error(reply.error)
    return reply.value
  }
  return { document, ask, observe: () => ask({ op: 'observe' }) as PageReading }
}

describe('the page an agent reads in the scratch tab', () => {
  it('lists the visible controls with a ref, role and accessible name', () => {
    const reading = page().observe()
    expect(reading.title).toBe('Acme Running')
    expect(reading.elementsTruncated).toBe(false)
    expect(reading.elements).toEqual([
      { ref: 'e1', role: 'link', name: 'Pricing page', value: null, disabled: false },
      { ref: 'e2', role: 'button', name: '', value: null, disabled: false },
      { ref: 'e3', role: 'textbox', name: 'Email', value: 'test@example.com', disabled: false },
      { ref: 'e4', role: 'textbox', name: 'Password', value: null, disabled: false },
      { ref: 'e5', role: 'button', name: 'Off', value: null, disabled: true },
      { ref: 'e6', role: 'tab', name: 'Monthly', value: null, disabled: false },
      { ref: 'e7', role: 'combobox', name: 'Plan', value: 'Pro', disabled: false },
      { ref: 'e8', role: 'button', name: 'Request a free audit', value: null, disabled: false },
    ])
    expect(reading.text).toContain('Plans')
  })

  it('keeps each element’s ref between observations', () => {
    const { document, observe } = page()
    observe()
    const link = document.createElement('a')
    link.setAttribute('href', '/contact')
    link.textContent = 'Contact'
    document.body.prepend(link)
    const again = observe().elements
    expect(again.find((e) => e.name === 'Pricing page')?.ref).toBe('e1')
    expect(again.find((e) => e.name === 'Contact')?.ref).toBe('e9')
  })

  it('cuts a very long page and says so', () => {
    const links = Array.from({ length: ELEMENT_LIMIT + 5 }, (_, i) => `<a href="/${i}">L${i}</a>`)
    const words = 'word '.repeat(TEXT_LIMIT / 4)
    const reading = page(`<html><body>${links.join('')}<p>${words}</p></body></html>`).observe()
    expect(reading.elements).toHaveLength(ELEMENT_LIMIT)
    expect(reading.elementsTruncated).toBe(true)
    expect(reading.text).toHaveLength(TEXT_LIMIT)
    expect(reading.textFullLength).toBeGreaterThan(TEXT_LIMIT)
  })
})

describe('acting on the scratch tab', () => {
  it('tells the policy a button submits its form', () => {
    const { ask, observe } = page()
    observe()
    expect(ask({ op: 'describe', ref: 'e8' })).toEqual<ActionTarget>({
      role: 'button',
      name: 'Request a free audit',
      tag: 'button',
      type: null,
      autocomplete: null,
      submits: true,
    })
    expect(ask({ op: 'describe', ref: 'e99' })).toBeNull()
    expect(ask({ op: 'describe', ref: '"] *' })).toBeNull()
  })

  it('fills a field and picks an option with input and change events', () => {
    const { document, ask, observe } = page()
    observe()
    const events: string[] = []
    const email = document.getElementById('email')
    email?.addEventListener('input', () => events.push('input'))
    email?.addEventListener('change', () => events.push('change'))

    ask({ op: 'perform', action: { kind: 'type', ref: 'e3', text: 'ana@example.com' } })
    ask({ op: 'perform', action: { kind: 'select', ref: 'e7', value: 'Team' } })

    expect(events).toEqual(['input', 'change'])
    const reading = observe()
    expect(reading.elements.find((e) => e.ref === 'e3')?.value).toBe('ana@example.com')
    expect(reading.elements.find((e) => e.ref === 'e7')?.value).toBe('Team')
  })

  it('clicks a link in place and reports a ref the page no longer has', () => {
    const { document, ask, observe } = page(
      '<html><body><a href="/a" target="_blank">Docs</a></body></html>',
    )
    observe()
    let clicked = false
    document.querySelector('a')?.addEventListener('click', () => (clicked = true))
    ask({ op: 'perform', action: { kind: 'click', ref: 'e1' } })
    expect(clicked).toBe(true)
    expect(document.querySelector('a')?.hasAttribute('target')).toBe(false)
    expect(() => ask({ op: 'perform', action: { kind: 'click', ref: 'e5' } })).toThrow(
      'No element has ref e5 on this page.',
    )
  })
})
