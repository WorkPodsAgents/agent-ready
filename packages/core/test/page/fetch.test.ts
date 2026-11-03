import { describe, expect, it } from 'vitest'
import type { FetchRequest, FetchResponse, Fetcher } from '../../src/io'
import { auditPage, fetchPage } from '../../src/page'
import { OPEN_SITE, parse } from './pages'

/** Each URL answers as listed; a redirect names its target in `location`. */
function site(answers: Record<string, { status: number; location?: string; body?: string }>) {
  const requested: string[] = []
  const fetcher: Fetcher = {
    async fetch(request: FetchRequest): Promise<FetchResponse> {
      requested.push(request.url)
      const answer = answers[request.url] ?? { status: 404 }
      return {
        url: request.url,
        status: answer.status,
        headers: answer.location === undefined ? {} : { Location: answer.location },
        body: answer.body ?? '',
      }
    },
  }
  return { fetcher, requested }
}

const PAGE = '<html><head><title>Trail shoes</title></head><body><h1>Trail</h1></body></html>'

describe('fetching a page without JavaScript', () => {
  it('follows a redirect chain by hand and records every hop', async () => {
    const { fetcher } = site({
      'http://example.com/trail': { status: 301, location: 'https://example.com/trail' },
      'https://example.com/trail': { status: 302, location: '/shoes/trail' },
      'https://example.com/shoes/trail': { status: 200, body: PAGE },
    })
    const snapshot = await fetchPage(fetcher, parse, 'http://example.com/trail')
    expect(snapshot).toMatchObject({
      url: 'https://example.com/shoes/trail',
      requestedUrl: 'http://example.com/trail',
      status: 200,
      redirects: [
        { url: 'http://example.com/trail', status: 301, location: 'https://example.com/trail' },
        {
          url: 'https://example.com/trail',
          status: 302,
          location: 'https://example.com/shoes/trail',
        },
      ],
      rendered: null,
    })
    expect(snapshot.raw.querySelector('h1')?.textContent).toBe('Trail')
    const findings = auditPage(snapshot, OPEN_SITE)
    const chain = findings.find((found) => found.checkId === 'redirect_chain')
    expect(chain).toMatchObject({
      status: 'fail',
      summary: 'The URL redirects 2 times before the page answers.',
    })
    const canonical = findings.find((found) => found.checkId === 'missing_canonical')
    expect(canonical?.status).toBe('pass')
  })

  it('passes a single redirect', async () => {
    const { fetcher } = site({
      'https://example.com/a': { status: 308, location: '/b' },
      'https://example.com/b': { status: 200, body: PAGE },
    })
    const findings = auditPage(await fetchPage(fetcher, parse, 'https://example.com/a'), OPEN_SITE)
    expect(findings.find((found) => found.checkId === 'redirect_chain')?.status).toBe('pass')
  })

  it('stops at a loop and reports it', async () => {
    const { fetcher, requested } = site({
      'https://example.com/a': { status: 301, location: '/b' },
      'https://example.com/b': { status: 302, location: '/a' },
    })
    const snapshot = await fetchPage(fetcher, parse, 'https://example.com/a')
    expect(requested).toEqual(['https://example.com/a', 'https://example.com/b'])
    expect(snapshot.status).toBe(302)
    const findings = auditPage(snapshot, OPEN_SITE)
    const status = (id: string) => findings.find((found) => found.checkId === id)?.status
    expect([status('redirect_loop'), status('redirect_chain'), status('non_200_status')]).toEqual([
      'fail',
      'not_applicable',
      'fail',
    ])
  })

  it('gives up after 10 redirects', async () => {
    const answers = Object.fromEntries(
      Array.from({ length: 12 }, (_, at) => [
        `https://example.com/${at}`,
        { status: 301, location: `/${at + 1}` },
      ]),
    )
    const { fetcher, requested } = site(answers)
    const snapshot = await fetchPage(fetcher, parse, 'https://example.com/0')
    expect(requested).toHaveLength(10)
    expect(snapshot.redirects).toHaveLength(10)
  })
})
