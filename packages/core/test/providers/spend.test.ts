import { describe, expect, it } from 'vitest'
import { createResponseCache, createSpendLedger, ProviderError } from '../../src/providers'
import { memoryStore } from './doubles'

const DAY = 24 * 60 * 60 * 1000

function setup(start: string) {
  let now = Date.parse(start)
  const storage = memoryStore()
  const clock = () => now
  return {
    storage,
    ledger: createSpendLedger({ storage, clock }),
    cache: createResponseCache({ storage, clock }),
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('the monthly spend cap', () => {
  it('given no cap, when a paid call asks, then it is refused', async () => {
    const { ledger } = setup('2026-11-10T00:00:00Z')

    await expect(ledger.authorize('cloro', 0.01)).rejects.toMatchObject({
      failure: { code: 'cap_not_set', provider: 'cloro' },
    })
  })

  it('given calls in flight, when another would pass the cap, then it is refused', async () => {
    const { ledger } = setup('2026-11-10T00:00:00Z')
    await ledger.setCap('dataforseo', 1)

    const first = await ledger.authorize('dataforseo', 0.6)
    const second = ledger.authorize('dataforseo', 0.6)

    await expect(second).rejects.toBeInstanceOf(ProviderError)
    await first.settle(0.55)
    expect((await ledger.summary()).providers.dataforseo).toEqual({
      capUsd: 1,
      spentUsd: 0.55,
      reservedUsd: 0,
    })
  })

  it('given a released reservation, then its estimate is free again', async () => {
    const { ledger } = setup('2026-11-10T00:00:00Z')
    await ledger.setCap('cloro', 0.01)

    ;(await ledger.authorize('cloro', 0.01)).release()

    await expect(ledger.authorize('cloro', 0.01)).resolves.toBeDefined()
  })

  it('given a new month, then spend restarts and the cap stays', async () => {
    const { ledger, advance } = setup('2026-11-30T23:00:00Z')
    await ledger.setCap('dataforseo', 2)
    await (await ledger.authorize('dataforseo', 1.5)).settle(1.9)

    advance(2 * 60 * 60 * 1000)

    expect(await ledger.summary()).toEqual({
      month: '2026-12',
      providers: {
        dataforseo: { capUsd: 2, spentUsd: 0, reservedUsd: 0 },
        cloro: { capUsd: null, spentUsd: 0, reservedUsd: 0 },
      },
    })
  })
})

describe('the response cache', () => {
  it('given a stored response, when seven days pass, then it is gone', async () => {
    const { cache, advance } = setup('2026-11-10T00:00:00Z')
    await cache.put('dataforseo', '/v3/x', { b: 1, a: 'Shoes' }, { rows: 3 })

    expect(await cache.get('dataforseo', '/v3/x', { a: 'shoes', b: 1 })).toEqual({ rows: 3 })
    expect(await cache.get('dataforseo', '/v3/y', { a: 'shoes', b: 1 })).toBeUndefined()

    advance(7 * DAY)
    expect(await cache.get('dataforseo', '/v3/x', { a: 'shoes', b: 1 })).toBeUndefined()
  })

  it('stores keys as digests, so request text is not in key names', async () => {
    const { cache, storage } = setup('2026-11-10T00:00:00Z')
    await cache.put('cloro', '/v1/monitor/chatgpt', { prompt: 'best acme shoes' }, {})

    expect([...storage.data.keys()].join()).toMatch(/^cache:[0-9a-f]{64}$/)
  })
})
