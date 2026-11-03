// An in-memory site behind the Fetcher seam: each URL answers as written, anything else 404.
import type { FetchRequest, FetchResponse, Fetcher } from '../../src/io'

export interface Answer {
  readonly status?: number
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: string
}

export interface FakeSite extends Fetcher {
  readonly requests: FetchRequest[]
}

export function fakeSite(
  answers: Readonly<Record<string, Answer | ((r: FetchRequest) => Answer)>>,
): FakeSite {
  const requests: FetchRequest[] = []
  return {
    requests,
    async fetch(request: FetchRequest): Promise<FetchResponse> {
      requests.push(request)
      const entry = answers[request.url]
      const answer = typeof entry === 'function' ? entry(request) : (entry ?? { status: 404 })
      return {
        url: request.url,
        status: answer.status ?? 200,
        headers: answer.headers ?? {},
        body: answer.body ?? '',
      }
    },
  }
}
