import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cloro, SpendLedger } from '../../src/providers'
import {
  CLORO_USD_PER_CREDIT,
  createCloro,
  createResponseCache,
  createSpendLedger,
} from '../../src/providers'
import { fixture, json, memoryStore, stubFetch } from './doubles'

const NOW = Date.parse('2026-11-01T09:30:00Z')
let ledger: SpendLedger
let cloro: Cloro

beforeEach(async () => {
  const storage = memoryStore()
  ledger = createSpendLedger({ storage, clock: () => NOW })
  await ledger.setCap('cloro', 1)
  cloro = createCloro({
    ledger,
    cache: createResponseCache({ storage, clock: () => NOW }),
    apiKey: async () => 'cl_test_key',
    clock: () => NOW,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Cloro answers', () => {
  it('given a ChatGPT answer, then text and each distinct citation come back', async () => {
    const sent = stubFetch({ '/v1/monitor/chatgpt': json(await fixture('cloro', 'chatgpt')) })

    const answer = await cloro.ask({ engine: 'chatgpt', prompt: 'best trail shoes', country: 'gb' })

    expect(sent[0]?.headers.get('Authorization')).toBe('Bearer cl_test_key')
    expect(sent[0]?.body).toEqual({ prompt: 'best trail shoes', country: 'GB' })
    expect(answer.data).toEqual({
      engine: 'chatgpt',
      prompt: 'best trail shoes',
      text: expect.stringContaining('**Acme Running**'),
      citations: [
        { url: 'https://www.acmerunning.example/ridge-3', title: 'Ridge 3 by Acme Running' },
        { url: 'https://reviews.example/best-trail-shoes', title: 'Best trail shoes' },
        { url: 'https://shop.shoeworld.example/trail', title: 'Trail at Shoe World' },
      ],
      capturedAt: '2026-11-01T09:30:00.000Z',
      source: 'cloro',
    })
    expect(answer.costUsd).toBeCloseTo(5 * CLORO_USD_PER_CREDIT, 9)
  })

  it('given an answer from memory with no charge, then it costs the estimate', async () => {
    stubFetch({ '/v1/monitor/gemini': json(await fixture('cloro', 'gemini_memory')) })

    const answer = await cloro.ask({ engine: 'gemini', prompt: 'trail shoe brands' })

    expect(answer.data.citations).toEqual([])
    expect((await ledger.summary()).providers.cloro.spentUsd).toBeCloseTo(4 * CLORO_USD_PER_CREDIT)
  })

  it('given Cloro reports its charge in a header, then that charge is what the cap counts', async () => {
    const body = { success: true, result: { text: 'Acme Running and Shoe World.', sources: [] } }
    stubFetch({ '/v1/monitor/aimode': json(body, 200, { 'X-Credits-Charged': '9' }) })

    const answer = await cloro.ask({ engine: 'ai_mode', prompt: 'trail shoe brands' })

    expect(answer.costUsd).toBeCloseTo(9 * CLORO_USD_PER_CREDIT, 9)
  })

  it('given a blank answer, when asked, then it fails as an invalid response', async () => {
    stubFetch({ '/v1/monitor/aimode': json(await fixture('cloro', 'blank')) })

    await expect(cloro.ask({ engine: 'ai_mode', prompt: 'x' })).rejects.toMatchObject({
      failure: { code: 'invalid_response', provider: 'cloro' },
    })
  })

  it('given HTTP 429 with Retry-After, then the wait comes from the header', async () => {
    stubFetch({ '/v1/monitor/chatgpt': json({}, 429, { 'Retry-After': '12' }) })

    await expect(cloro.ask({ engine: 'chatgpt', prompt: 'x' })).rejects.toMatchObject({
      failure: { code: 'rate_limited', retryAfterS: 12 },
    })
  })

  it('given a bad key, then auth_failed without echoing the key', async () => {
    stubFetch({ '/v1/monitor/chatgpt': json({ error: 'bad key cl_test_key' }, 401) })

    const error = await cloro.ask({ engine: 'chatgpt', prompt: 'x' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ failure: { code: 'auth_failed' } })
    expect(String(error)).not.toContain('cl_test_key')
    expect(JSON.stringify(error)).not.toContain('cl_test_key')
  })
})
