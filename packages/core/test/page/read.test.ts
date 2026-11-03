import { describe, expect, it } from 'vitest'
import { extractFacts, seeAsAgent, selectorFor } from '../../src/page'
import { fixture, pageAt, parse } from './pages'

describe('what a crawl keeps of a page', () => {
  it('keeps the head, headings, links and a hash of the rendered page', async () => {
    const html = fixture('good.html')
    const facts = extractFacts(
      await pageAt('https://example.com/', html, {
        rendered: html,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    )
    expect(facts).toMatchObject({
      url: 'https://example.com/',
      status: 200,
      contentType: 'text/html; charset=utf-8',
      title: 'Acme Running: trail and road shoes fitted in store',
      h1s: ['Running shoes fitted to the way you run'],
      canonical: 'https://example.com/',
      noindex: false,
      hreflang: [
        { lang: 'en', url: 'https://example.com/' },
        { lang: 'en-gb', url: 'https://example.com/uk/' },
        { lang: 'zh-hant-tw', url: 'https://example.com/tw/' },
        { lang: 'x-default', url: 'https://example.com/' },
      ],
    })
    expect(facts.wordCount).toBeGreaterThanOrEqual(250)
    expect(facts.links).toContainEqual({
      url: 'https://example.com/shoes/trail',
      rel: [],
      text: 'Trail shoes',
      internal: true,
    })
    expect(facts.links).toContainEqual({
      url: 'https://partner.example.org/',
      rel: ['nofollow'],
      text: 'Our race partner',
      internal: false,
    })
    expect(facts.textHash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('resolves links, drops fragments and skips mail and script links', async () => {
    const html = `<body><a href="guide#fit">Fit</a><a href="mailto:a@example.com">Mail</a>
      <a href="javascript:void(0)">Menu</a><a href="https://shop.example.com/x">Shop</a></body>`
    const facts = extractFacts(await pageAt('https://www.example.com/shoes/', html))
    expect(facts.links.map((link) => [link.url, link.internal])).toEqual([
      ['https://www.example.com/shoes/guide', true],
      ['https://shop.example.com/x', true],
    ])
  })

  it('hashes equal text equally, whatever its markup, case and spacing', async () => {
    const hash = async (html: string) =>
      extractFacts(await pageAt('https://example.com/a', html)).textHash
    const one = await hash('<p>Trail shoes <b>for</b> mud</p>')
    expect(await hash('<div>trail   shoes</div><span>for</span> MUD<script>x()</script>')).toBe(one)
    expect(await hash('<p>Road shoes for mud</p>')).not.toBe(one)
  })
})

describe('seeing a page as an AI crawler', () => {
  it('sets the raw HTML beside the rendered page', async () => {
    const view = seeAsAgent(
      await pageAt('https://example.com/', fixture('js-shell-raw.html'), {
        rendered: fixture('good.html'),
      }),
    )
    expect(view.raw).toEqual({ words: 1, headings: [], schemaTypes: [], links: 0 })
    expect(view.rendered?.headings[0]).toEqual({
      level: 1,
      text: 'Running shoes fitted to the way you run',
    })
    expect(view.rendered?.schemaTypes).toEqual(['Organization', 'ContactPoint', 'WebSite'])
    expect(view.textShare).toBeCloseTo(1 / (view.rendered?.words ?? 1))
    expect(view.rawExcerpt).toBe('Loading')
    expect(view.webMcpTools.map((tool) => [tool.name, tool.complete])).toEqual([
      ['book_fitting', true],
    ])
    expect(JSON.parse(JSON.stringify(view))).toEqual(view)
  })

  it('describes each WebMCP field from its label, group or own words', async () => {
    const view = seeAsAgent(await pageAt('https://example.com/', fixture('good.html')))
    expect(view.rendered).toBeNull()
    expect(view.textShare).toBeNull()
    expect(view.webMcpTools[0]?.params).toEqual([
      { name: 'name', type: 'text', required: true, options: [], description: 'Your name' },
      { name: 'day', type: 'date', required: false, options: [], description: 'Preferred day' },
      {
        name: 'surface',
        type: 'radio',
        required: false,
        options: ['road', 'trail'],
        description: 'The kind of running you do most',
      },
      {
        name: 'store',
        type: 'select',
        required: false,
        options: ['main', 'harbor'],
        description: 'Which store to visit',
      },
    ])
  })

  it('cuts the raw text excerpt at 2,000 characters', async () => {
    const view = seeAsAgent(await pageAt('https://example.com/', `<p>${'word '.repeat(1000)}</p>`))
    expect(view.rawExcerpt).toHaveLength(2000)
  })
})

describe('selectors for highlighting', () => {
  it('finds each element again, by a unique id or a tag path', () => {
    const doc = parse(
      '<html><body><div id="a"><p>1</p><p id="dup">2</p></div><p id="dup">3</p></body></html>',
      'https://example.com/',
    )
    for (const element of Array.from(doc.querySelectorAll('p, div'))) {
      expect(doc.querySelector(selectorFor(element))).toBe(element)
    }
    expect(selectorFor(doc.querySelectorAll('p')[1] as Element)).toBe('#a > p:nth-of-type(2)')
  })
})
