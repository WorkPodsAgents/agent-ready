import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { readSerp } from '../../src/readers/serp/read-serp'

const url = 'https://www.google.com/search?q=running+shoes+for+flat+feet'
const page = (): Document =>
  parseHTML(readFileSync(new URL('../fixtures/serp/google-results.html', import.meta.url), 'utf8'))
    .document as unknown as Document

describe('results page reader', () => {
  it('reads the top ten organic results, skipping ads, PAA answers and Google links', () => {
    const { organic } = readSerp(page(), url)
    expect(organic.map((r) => r.url)).toEqual([
      'https://reviews.example/flat-feet',
      'https://stride.example/guide-9',
      'https://www.acmerunning.example/arch-pro',
      'https://www.youtube.com/watch?v=abc',
      'https://forum.example/thread/12',
      'https://shop.example/a',
      'https://shop.example/b',
      'https://shop.example/c',
      'https://shop.example/d',
      'https://shop.example/e',
    ])
    expect(organic[0]).toEqual({
      position: 1,
      url: 'https://reviews.example/flat-feet',
      title: 'Best shoes for flat feet',
    })
  })

  it('reads People Also Ask, related searches, the query and the AI Overview', () => {
    const reading = readSerp(page(), url)
    expect(reading.query).toBe('running shoes for flat feet')
    expect(reading.peopleAlsoAsk).toEqual([
      'Are stability shoes good for flat feet?',
      'What brand is best for flat feet?',
    ])
    expect(reading.relatedSearches).toEqual(['best stability running shoes', 'flat feet insoles'])
    expect(reading.aiOverview).toBe(true)
  })

  it('finds People Also Ask by its heading when the data attributes are gone', () => {
    const doc = page()
    for (const el of Array.from(doc.querySelectorAll('[data-q]'))) el.removeAttribute('data-q')
    expect(readSerp(doc, url).peopleAlsoAsk).toEqual([
      'Are stability shoes good for flat feet?',
      'What brand is best for flat feet?',
    ])
  })

  it('reports an empty page as having nothing', () => {
    const doc = parseHTML('<html><body><div id="rso"></div></body></html>')
      .document as unknown as Document
    expect(readSerp(doc, url)).toEqual({
      query: 'running shoes for flat feet',
      organic: [],
      peopleAlsoAsk: [],
      relatedSearches: [],
      aiOverview: false,
    })
  })
})
