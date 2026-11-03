import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataForSeo, SpendLedger } from '../../src/providers'
import {
  createDataForSeo,
  createResponseCache,
  createSpendLedger,
  ProviderError,
} from '../../src/providers'
import type { Sent } from './doubles'
import { fixture, json, memoryStore, stubFetch } from './doubles'

const LABS = '/v3/dataforseo_labs/google'

let ledger: SpendLedger
let client: DataForSeo

beforeEach(async () => {
  const storage = memoryStore()
  const clock = () => Date.parse('2026-11-01T12:00:00Z')
  ledger = createSpendLedger({ storage, clock })
  await ledger.setCap('dataforseo', 5)
  client = createDataForSeo({
    ledger,
    cache: createResponseCache({ storage, clock }),
    credentials: async () => ({ login: 'user@example.com', password: 'p4ss' }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function only(sent: Sent[]): Sent {
  expect(sent).toHaveLength(1)
  const [request] = sent
  if (request === undefined) throw new Error('no request')
  return request
}

async function failure(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ProviderError)
  return (error as ProviderError).failure
}

describe('DataForSEO keyword research', () => {
  it('given seeds, when ideas are asked, then one task goes with Basic auth', async () => {
    const sent = stubFetch({
      [`${LABS}/keyword_ideas/live`]: json(await fixture('dataforseo', 'keyword_ideas')),
    })

    const ideas = await client.keywordIdeas(['trail running shoes'], { location: 'gb' }, 50)

    const request = only(sent)
    expect(request.headers.get('Authorization')).toBe(`Basic ${btoa('user@example.com:p4ss')}`)
    expect(request.body).toEqual([
      expect.objectContaining({
        keywords: ['trail running shoes'],
        location_code: 2826,
        language_code: 'en',
        limit: 50,
      }),
    ])
    expect(ideas.costUsd).toBe(0.01236)
    expect(ideas.data.totalCount).toBe(1820)
    expect(ideas.data.ideas[1]).toEqual({
      keyword: 'best trail running shoes for beginners',
      searchVolume: 6600,
      cpcUsd: 1.2,
      competition: 0.4,
      keywordDifficulty: 24,
      intent: 'commercial',
    })
  })

  it('given a low KD on a strong SERP, then the keyword is not called easy', async () => {
    const sent = stubFetch({
      [`${LABS}/keyword_overview/live`]: json(await fixture('dataforseo', 'keyword_overview')),
      '/v3/serp/google/organic/live/advanced': json(await fixture('dataforseo', 'serp_organic')),
      '/v3/backlinks/bulk_ranks/live': json(await fixture('dataforseo', 'bulk_ranks')),
    })

    const view = await client.keywordView('running shoe store near me')

    expect(sent).toHaveLength(3)
    const ranks = sent.find((r) => r.url.endsWith('/bulk_ranks/live'))
    expect(ranks?.body).toEqual([
      expect.objectContaining({
        targets: [
          'bigsports.example',
          'shoeworld.example',
          'acmerunning.example',
          'maps.example',
          'runnersblog.example',
        ],
      }),
    ])
    expect(view.data?.keywordDifficulty).toBe(12)
    expect(view.data?.top10.map((r) => [r.rank, r.domainRank])).toEqual([
      [1, 71],
      [2, 58],
      [3, 22],
      [4, 90],
      [5, null],
    ])
    expect(view.data?.strongDomains).toBe(3)
    expect(view.data?.verdict).toBe('kd_understates')
    expect(view.costUsd).toBeCloseTo(0.01212 + 0.002 + 0.02418, 6)
  })

  it('given the user outranks the top 10, then the low KD is easy', async () => {
    stubFetch({
      [`${LABS}/keyword_overview/live`]: json(await fixture('dataforseo', 'keyword_overview')),
      '/v3/serp/google/organic/live/advanced': json(await fixture('dataforseo', 'serp_organic')),
      '/v3/backlinks/bulk_ranks/live': json(await fixture('dataforseo', 'bulk_ranks')),
    })

    const view = await client.keywordView('running shoe store near me', {}, 95)

    expect(view.data?.strongDomains).toBe(0)
    expect(view.data?.verdict).toBe('easy')
  })

  it('given "no results", then the answer is empty, not a failure', async () => {
    stubFetch({
      [`${LABS}/keyword_overview/live`]: json(await fixture('dataforseo', 'no_results')),
    })

    const metrics = await client.keywordMetrics(['zzqx shoes'])

    expect(metrics.data).toEqual([])
  })
})

describe('DataForSEO competitor research', () => {
  it('given a domain, then competitors come with shared keywords and traffic', async () => {
    const sent = stubFetch({
      [`${LABS}/competitors_domain/live`]: json(await fixture('dataforseo', 'competitors_domain')),
    })

    const competitors = await client.competitorsDomain('https://www.AcmeRunning.example/')

    expect(only(sent).body).toEqual([expect.objectContaining({ target: 'acmerunning.example' })])
    expect(competitors.data[0]).toEqual({
      domain: 'shoeworld.example',
      avgPosition: 14.2,
      sharedKeywords: 300,
      organicKeywords: 15400,
      organicTraffic: 88200.5,
    })
  })

  it('given competitors, then the keyword gap puts each against the user', async () => {
    const sent = stubFetch({
      [`${LABS}/domain_intersection/live`]: json(
        await fixture('dataforseo', 'domain_intersection'),
      ),
    })

    const gap = await client.keywordGap('acmerunning.example', ['shoeworld.example'])

    expect(only(sent).body).toEqual([
      expect.objectContaining({
        target1: 'shoeworld.example',
        target2: 'acmerunning.example',
        intersections: false,
      }),
    ])
    expect(gap.data[0]?.competitor).toBe('shoeworld.example')
    expect(gap.data[0]?.keywords[0]).toMatchObject({
      keyword: 'marathon training plan',
      searchVolume: 33100,
      position: 3,
      url: 'https://shoeworld.example/guides/marathon-plan',
    })
  })

  it('given a domain, then ranked keywords have position and traffic', async () => {
    stubFetch({
      [`${LABS}/ranked_keywords/live`]: json(await fixture('dataforseo', 'ranked_keywords')),
    })

    const ranked = await client.rankedKeywords('acmerunning.example')

    expect(ranked.data.totalCount).toBe(912)
    expect(ranked.data.keywords[1]).toMatchObject({
      keyword: 'waterproof trail shoes',
      keywordDifficulty: 31,
      position: 7,
      trafficEstimate: 62.4,
    })
  })
})

describe('DataForSEO backlinks', () => {
  it('given a domain, then its summary has rank, links and referring domains', async () => {
    stubFetch({
      '/v3/backlinks/summary/live': json(await fixture('dataforseo', 'backlinks_summary')),
    })

    const summary = await client.backlinksSummary('acmerunning.example')

    expect(summary.data).toEqual({
      target: 'acmerunning.example',
      rank: 34,
      backlinks: 18240,
      referringDomains: 612,
      brokenBacklinks: 41,
      spamScore: 3,
    })
  })

  it('given referring domains, then a missing first-seen date stays null', async () => {
    stubFetch({
      '/v3/backlinks/referring_domains/live': json(
        await fixture('dataforseo', 'referring_domains'),
      ),
    })

    const referring = await client.referringDomains('acmerunning.example', 2)

    expect(referring.data.domains).toEqual([
      {
        domain: 'runnersweekly.example',
        rank: 61,
        backlinks: 12,
        firstSeen: '2023-02-11 08:00:00 +00:00',
      },
      { domain: 'localclub.example', rank: 18, backlinks: 3, firstSeen: null },
    ])
  })

  it('given competitors, then each link gap domain lists whom it links to', async () => {
    const sent = stubFetch({
      '/v3/backlinks/domain_intersection/live': json(
        await fixture('dataforseo', 'backlinks_domain_intersection'),
      ),
    })

    const gap = await client.linkGap('acmerunning.example', [
      'shoeworld.example',
      'trailhub.example',
    ])

    expect(only(sent).body).toEqual([
      expect.objectContaining({
        targets: { '1': 'shoeworld.example', '2': 'trailhub.example' },
        exclude_targets: ['acmerunning.example'],
      }),
    ])
    expect(gap.data.domains).toEqual([
      {
        domain: 'gearreview.example',
        rank: 66,
        linksTo: ['shoeworld.example', 'trailhub.example'],
      },
      { domain: 'citymarathon.example', rank: 40, linksTo: ['trailhub.example'] },
    ])
  })

  it('given no Backlinks subscription (40204), then it fails with no_access', async () => {
    stubFetch({ '/v3/backlinks/summary/live': json(await fixture('dataforseo', 'no_access')) })

    expect(await failure(client.backlinksSummary('acmerunning.example'))).toEqual({
      code: 'no_access',
      provider: 'dataforseo',
    })
  })
})

describe('DataForSEO failures, cache and spend', () => {
  it('given a wrong password, then auth_failed and nothing is spent', async () => {
    stubFetch({
      [`${LABS}/keyword_overview/live`]: json(await fixture('dataforseo', 'auth_failed')),
    })

    expect((await failure(client.keywordMetrics(['shoes']))).code).toBe('auth_failed')
    const spend = (await ledger.summary()).providers.dataforseo
    expect(spend).toMatchObject({ spentUsd: 0, reservedUsd: 0 })
  })

  it('given HTTP 429, when a call is made, then it fails as rate limited with a wait', async () => {
    stubFetch({
      '/v3/serp/google/organic/live/advanced': new Response('Too Many Requests', { status: 429 }),
    })

    expect(await failure(client.serpTop10('shoes'))).toEqual({
      code: 'rate_limited',
      provider: 'dataforseo',
      retryAfterS: 60,
    })
  })

  it('given an invalid field (40501), then it is refused with the status', async () => {
    stubFetch({
      '/v3/serp/google/organic/live/advanced': json(await fixture('dataforseo', 'task_refused')),
    })

    expect(await failure(client.serpTop10('shoes'))).toEqual({
      code: 'refused',
      provider: 'dataforseo',
      status: 40501,
    })
  })

  it('given an unknown country, then it fails before any request', async () => {
    const sent = stubFetch({})

    expect((await failure(client.keywordMetrics(['shoes'], { location: 'XX' }))).code).toBe(
      'invalid_input',
    )
    expect(sent).toHaveLength(0)
  })

  it('given the same question twice, then the cache answers for free', async () => {
    const sent = stubFetch({
      [`${LABS}/keyword_ideas/live`]: json(await fixture('dataforseo', 'keyword_ideas')),
    })

    await client.keywordIdeas(['Trail running shoes'])
    const again = await client.keywordIdeas([' trail running shoes '])

    expect(sent).toHaveLength(1)
    expect(again).toMatchObject({ costUsd: 0, cached: true })
    expect(again.data.ideas).toHaveLength(3)
    expect((await ledger.summary()).providers.dataforseo.spentUsd).toBe(0.01236)
  })

  it('given a cap the estimate would pass, then the call is refused unsent', async () => {
    await ledger.setCap('dataforseo', 0.01)
    const sent = stubFetch({})

    expect(await failure(client.keywordIdeas(['shoes'], {}, 100))).toEqual({
      code: 'over_cap',
      provider: 'dataforseo',
      capUsd: 0.01,
      spentUsd: 0,
      estimateUsd: 0.024,
    })
    expect(sent).toHaveLength(0)
  })

  it('given no credentials, when a call is made, then it fails as not configured', async () => {
    const unconfigured = createDataForSeo({
      ledger,
      cache: createResponseCache({ storage: memoryStore(), clock: Date.now }),
      credentials: async () => null,
    })
    stubFetch({})

    expect((await failure(unconfigured.bulkRanks(['example.com']))).code).toBe('not_configured')
    expect((await ledger.summary()).providers.dataforseo.reservedUsd).toBe(0)
  })
})
