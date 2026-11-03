import { describe, expect, it } from 'vitest'
import { auditPage } from '../../src/page'
import { OPEN_SITE, pageAt } from './pages'

async function unnamed(body: string): Promise<string[]> {
  const snapshot = await pageAt('https://example.com/a', `<html><body>${body}</body></html>`)
  const found = auditPage(snapshot, OPEN_SITE).find((f) => f.checkId === 'controls_unlabelled')
  return (found?.evidence ?? []).map((entry) => entry.selector ?? '')
}

describe('accessible names of controls', () => {
  it('names a control by its label, aria, title, value, content or image alt', async () => {
    expect(
      await unnamed(`
        <span id="lbl">Search shoes</span><input id="q" aria-labelledby="lbl">
        <label for="size">Size</label><input id="size">
        <label>Width <select><option>Wide</option></select></label>
        <textarea placeholder="Notes"></textarea>
        <button aria-label="Close"></button>
        <a href="/cart" title="Cart"></a>
        <a href="/home"><img src="/logo.png" alt="Home"></a>
        <a href="/help"><svg><title>Help</title></svg></a>
        <input type="submit">
        <div role="button">Next</div>
        <input type="hidden" name="token">
        <button hidden></button>
        <div style="display: none"><button></button></div>`),
    ).toEqual([])
  })

  it('finds a control with no name, wherever its label text hides', async () => {
    expect(
      await unnamed(`
        <label>    <select id="w"><option>Wide</option></select></label>
        <button><svg aria-hidden="true"><title>x</title></svg></button>
        <a href="/x"><img src="/x.png"></a>
        <input type="button">`),
    ).toEqual([
      '#w',
      'html > body:nth-of-type(1) > button:nth-of-type(1)',
      'html > body:nth-of-type(1) > a:nth-of-type(1)',
      'html > body:nth-of-type(1) > input:nth-of-type(1)',
    ])
  })
})
