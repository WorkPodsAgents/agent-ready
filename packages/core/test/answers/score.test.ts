import { describe, expect, it } from 'vitest'
import type { AiAnswer, Party } from '../../src/answers'
import { historyCsv, scoreAnswer, shareOfVoice } from '../../src/answers'

const BRAND: Party = {
  name: 'Acme Running',
  aliases: ['Acme'],
  domains: ['https://www.acmerunning.example/'],
}
const SHOE_WORLD: Party = { name: 'Shoe World', aliases: [], domains: ['shoeworld.example'] }
const TRAIL_HUB: Party = { name: 'TrailHub', aliases: [], domains: ['trailhub.example'] }

function answer(
  text: string,
  urls: string[] = [],
  engine: AiAnswer['engine'] = 'chatgpt',
): AiAnswer {
  return {
    engine,
    prompt: 'best trail running shoes',
    text,
    citations: urls.map((url) => ({ url })),
    capturedAt: '2026-11-01T10:00:00.000Z',
    source: 'reader',
  }
}

function score(a: AiAnswer) {
  return scoreAnswer(a, { brand: BRAND, competitors: [SHOE_WORLD, TRAIL_HUB] })
}

describe('scoring an AI answer', () => {
  it('given an alias, when the answer uses it, then the brand is named with its sentence', () => {
    const scored = score(
      answer('Shoe World is cheap. For grip, acme makes the Ridge 3! Others exist.'),
    )

    expect(scored.parties[0]).toEqual({
      name: 'Acme Running',
      role: 'brand',
      status: 'named',
      named: true,
      cited: false,
      mentionOrder: 2,
      passage: 'For grip, acme makes the Ridge 3!',
      citedUrls: [],
    })
    expect(scored.parties[1]).toMatchObject({ status: 'named', mentionOrder: 1 })
    expect(scored.parties[2]).toMatchObject({ status: 'absent', mentionOrder: null, passage: null })
  })

  it('given the brand name inside another word, then it is not a mention', () => {
    const scored = score(answer('Acmeville Outfitters and TrailHubs both stock shoes.'))

    expect(scored.parties.map((p) => p.status)).toEqual(['absent', 'absent', 'absent'])
  })

  it('given a citation on a www or sub domain, then cited wins over named', () => {
    const scored = score(
      answer('Try Acme Running.', [
        'https://www.acmerunning.example/ridge-3',
        'https://shop.shoeworld.example/trail',
        'https://notshoeworld.example/',
      ]),
    )

    expect(scored.parties.map((p) => [p.name, p.status, p.citedUrls])).toEqual([
      ['Acme Running', 'cited', ['https://www.acmerunning.example/ridge-3']],
      ['Shoe World', 'cited', ['https://shop.shoeworld.example/trail']],
      ['TrailHub', 'absent', []],
    ])
  })

  it('given many answers, then share of voice counts overall and per engine', () => {
    const scored = [
      score(answer('Acme Running and Shoe World.', [], 'chatgpt')),
      score(answer('Shoe World only.', [], 'gemini')),
      score(answer('Nothing relevant.', ['https://trailhub.example/x'], 'gemini')),
    ]

    const voice = shareOfVoice(scored)

    expect(voice.answers).toBe(3)
    expect(voice.parties).toEqual([
      {
        name: 'Acme Running',
        role: 'brand',
        visible: 1,
        cited: 0,
        visibleRate: 1 / 3,
        share: 0.25,
      },
      {
        name: 'Shoe World',
        role: 'competitor',
        visible: 2,
        cited: 0,
        visibleRate: 2 / 3,
        share: 0.5,
      },
      {
        name: 'TrailHub',
        role: 'competitor',
        visible: 1,
        cited: 1,
        visibleRate: 1 / 3,
        share: 0.25,
      },
    ])
    expect(voice.byEngine.gemini?.answers).toBe(2)
    expect(voice.byEngine.gemini?.parties[0]).toMatchObject({ visible: 0, share: 0 })
  })

  it('given a history, then the CSV quotes commas and defuses formulas', () => {
    const scored = [score(answer('=HYPERLINK("x") is odd, but Acme Running, sure.'))]

    const csv = historyCsv(scored)
    const lines = csv.trimEnd().split('\r\n')

    expect(lines[0]).toBe(
      'captured_at,engine,prompt,party,role,status,mention_order,passage,cited_urls',
    )
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe(
      `2026-11-01T10:00:00.000Z,chatgpt,best trail running shoes,Acme Running,brand,named,1,` +
        `"'=HYPERLINK(""x"") is odd, but Acme Running, sure.",`,
    )
  })
})
