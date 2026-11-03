import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { engineFor } from '../../src/readers/engines'

const fixture = (name: string): Document =>
  parseHTML(readFileSync(new URL(`../fixtures/answers/${name}`, import.meta.url), 'utf8'))
    .document as unknown as Document

const html = (body: string): Document =>
  parseHTML(`<!doctype html><html><body>${body}</body></html>`).document as unknown as Document

function read(url: string, doc: Document) {
  const engine = engineFor(url)
  if (engine === null) throw new Error(`no engine for ${url}`)
  return engine.read(doc, url)
}

describe('engineFor', () => {
  it('picks the engine from the page address', () => {
    expect(engineFor('https://chatgpt.com/c/123')?.id).toBe('chatgpt')
    expect(engineFor('https://gemini.google.com/app/1')?.id).toBe('gemini')
    expect(engineFor('https://claude.ai/chat/1')?.id).toBe('claude')
    expect(engineFor('https://www.perplexity.ai/search/x')?.id).toBe('perplexity')
    expect(engineFor('https://www.google.com/search?q=shoes&udm=50')?.id).toBe('ai_mode')
    expect(engineFor('https://www.google.com/search?q=shoes')?.id).toBe('ai_overview')
    expect(engineFor('https://www.google.co.uk/search?q=shoes&udm=50')?.id).toBe('ai_mode')
    expect(engineFor('https://www.google.de/search?q=schuhe')?.id).toBe('ai_overview')
    expect(engineFor('https://www.google.com.au/search?q=shoes')?.id).toBe('ai_overview')
    expect(engineFor('https://www.google.evil.com/search?q=shoes')).toBeNull()
    expect(engineFor('https://example.com/')).toBeNull()
  })
})

describe('ChatGPT reader', () => {
  const url = 'https://chatgpt.com/c/abc'

  it('reads the newest answer with its prompt and cited sources', () => {
    const answer = read(url, fixture('chatgpt.html'))
    expect(answer?.prompt).toBe('Best running shoes for flat feet?')
    expect(answer?.text.split('\n')[0]).toBe(
      'For flat feet, look for stability shoes with firm arch support.',
    )
    expect(answer?.text).toContain('Acme Running Arch Pro')
    expect(answer?.text).not.toContain('older answer')
    expect(answer?.text).not.toContain('Copy')
    expect(answer?.citations.map((c) => c.url)).toEqual([
      'https://stride.example/guide-9',
      'https://www.acmerunning.example/arch-pro',
      'https://reviews.example/flat-feet-shoes',
    ])
    expect(answer?.streaming).toBe(false)
  })

  it('reports streaming while the stop button shows', () => {
    const doc = fixture('chatgpt.html')
    doc.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>')
    expect(read(url, doc)?.streaming).toBe(true)
  })

  it('falls back to the turn markup when the role attribute is gone', () => {
    const doc = html(
      '<article data-turn="assistant"><div class="markdown">Pick Acme.</div></article>',
    )
    expect(read(url, doc)?.text).toBe('Pick Acme.')
  })

  it('finds the prompt box', () => {
    expect(engineFor(url)?.promptInput(fixture('chatgpt.html'))?.id).toBe('prompt-textarea')
  })

  it('reads nothing on an empty chat', () => {
    expect(read(url, html('<main></main>'))).toBeNull()
  })
})

describe('Gemini reader', () => {
  const url = 'https://gemini.google.com/app/1'

  it('reads the answer, unwraps Google redirects and drops Google help links', () => {
    const answer = read(url, fixture('gemini.html'))
    expect(answer?.prompt).toBe('Which running shoe brands are best for marathons?')
    expect(answer?.text).toContain('Pacer Shoes makes the Long Run')
    expect(answer?.citations).toEqual([
      { url: 'https://runnersguide.example/marathon-shoes', title: 'this guide' },
      { url: 'https://pacershoes.example/long-run', title: 'Pacer Shoes: Long Run' },
    ])
    expect(answer?.streaming).toBe(false)
  })

  it('reports streaming while the response is busy', () => {
    const doc = fixture('gemini.html')
    doc.querySelector('message-content')?.setAttribute('aria-busy', 'true')
    expect(read(url, doc)?.streaming).toBe(true)
  })

  it('finds the rich-text prompt box', () => {
    expect(engineFor(url)?.promptInput(fixture('gemini.html'))?.className).toBe('ql-editor')
  })
})

describe('Claude reader', () => {
  const url = 'https://claude.ai/chat/1'

  it('reads the answer and its links', () => {
    const answer = read(url, fixture('claude.html'))
    expect(answer?.prompt).toBe('Compare Acme Running and Stride Co for beginners.')
    expect(answer?.text).toContain('Stride Co\nFirm and stable.')
    expect(answer?.citations).toEqual([
      { url: 'https://acmerunning.example/beginners', title: 'beginner guide' },
    ])
  })

  it('follows the data-is-streaming flag', () => {
    const doc = fixture('claude.html')
    doc.querySelector('[data-is-streaming]')?.setAttribute('data-is-streaming', 'true')
    expect(read(url, doc)?.streaming).toBe(true)
  })

  it('finds the prompt box by its label', () => {
    const input = engineFor(url)?.promptInput(fixture('claude.html'))
    expect(input?.getAttribute('aria-label')).toBe('Write your prompt to Claude')
  })
})

describe('Perplexity reader', () => {
  const url = 'https://www.perplexity.ai/search/where-to-buy'

  it('reads the answer and the sources strip once each', () => {
    const answer = read(url, fixture('perplexity.html'))
    expect(answer?.prompt).toBe('Where to buy running shoes online?')
    expect(answer?.text).toContain("Acme Running's own store")
    expect(answer?.citations.map((c) => c.url)).toEqual([
      'https://shoeshop.example/running',
      'https://acmerunning.example/shop',
    ])
  })
})

describe('Google readers', () => {
  it('reads an AI Overview by its heading, with the query as the prompt', () => {
    const url = 'https://www.google.com/search?q=best+trail+running+shoes'
    const answer = read(url, fixture('google-ai-overview.html'))
    expect(answer?.engine).toBe('ai_overview')
    expect(answer?.prompt).toBe('best trail running shoes')
    expect(answer?.text).toContain('Stride Co and Pacer Shoes both make well-reviewed models.')
    expect(answer?.citations).toEqual([
      { url: 'https://trailmag.example/best-trail-shoes', title: 'Trail Mag: Best trail shoes' },
    ])
  })

  it('reads nothing on a results page without an AI Overview', () => {
    const url = 'https://www.google.com/search?q=shoes'
    expect(
      read(url, html('<div id="rso"><a href="https://a.example"><h3>A</h3></a></div>')),
    ).toBeNull()
  })

  it('reads the latest AI Mode turn', () => {
    const url = 'https://www.google.com/search?q=lightest+racing+flats&udm=50'
    const answer = read(url, fixture('google-ai-mode.html'))
    expect(answer?.engine).toBe('ai_mode')
    expect(answer?.text).toContain('Pacer Shoes Dash is the lightest at 160 grams.')
    expect(answer?.citations.map((c) => c.url)).toEqual(['https://pacershoes.example/dash'])
    expect(engineFor(url)?.promptInput(fixture('google-ai-mode.html'))?.tagName).toBe('TEXTAREA')
  })
})
