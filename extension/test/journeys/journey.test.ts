import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeJourneys } from '../../src/journeys/bridge-journeys'
import type { JourneyModel, ModelTurn } from '../../src/journeys/models'
import { runJourney } from '../../src/journeys/run'
import { JourneySession, type JourneyPage } from '../../src/journeys/session'
import type {
  ActionTarget,
  BrowseAction,
  JourneyAction,
  JourneyResult,
  Observation,
} from '../../src/journeys/types'

// A two-page site: a home page linking to pricing, and a pricing page with a Buy button.
interface FakeElement {
  readonly ref: string
  readonly target: ActionTarget
  readonly goesTo?: string
}

const el = (ref: string, role: string, name: string, goesTo?: string): FakeElement => ({
  ref,
  target: {
    role,
    name,
    tag: role === 'link' ? 'a' : 'button',
    type: null,
    autocomplete: null,
    submits: false,
  },
  ...(goesTo === undefined ? {} : { goesTo }),
})

const SITE: Readonly<Record<string, { title: string; text: string; elements: FakeElement[] }>> = {
  'https://acme.example/': {
    title: 'Acme Running',
    text: 'Shoes for every runner.',
    elements: [
      el('e1', 'link', 'Pricing', 'https://acme.example/pricing'),
      el('e2', 'link', 'Log in'),
    ],
  },
  'https://acme.example/pricing': {
    title: 'Pricing',
    text: 'Pro plan: $49 a month.',
    elements: [el('e3', 'button', 'Buy now')],
  },
}

class FakePage implements JourneyPage {
  url = 'https://acme.example/'
  performed: BrowseAction[] = []
  closed = false

  async observe(): Promise<Observation> {
    const page = SITE[this.url]
    if (page === undefined) throw new Error(`no page ${this.url}`)
    return {
      url: this.url,
      title: page.title,
      elements: page.elements.map((e) => ({
        ref: e.ref,
        role: e.target.role,
        name: e.target.name,
        value: null,
        disabled: false,
      })),
      elementsTruncated: false,
      text: page.text,
      textFullLength: null,
      webMcp: { api: 'document.modelContext.getTools()', tools: ['search_products'] },
    }
  }

  async describe(ref: string): Promise<ActionTarget | null> {
    return SITE[this.url]?.elements.find((e) => e.ref === ref)?.target ?? null
  }

  async perform(action: BrowseAction): Promise<void> {
    this.performed.push(action)
    if (action.kind === 'click') {
      const next = SITE[this.url]?.elements.find((e) => e.ref === action.ref)?.goesTo
      if (next !== undefined) this.url = next
    }
  }

  async close(): Promise<void> {
    this.closed = true
  }
}

/** A model that plays back a fixed list of actions and remembers what it was shown. */
function scripted(actions: JourneyAction[]): JourneyModel & { turns: ModelTurn[] } {
  const turns: ModelTurn[] = []
  return {
    agent: 'Scripted test model',
    turns,
    async next(turn) {
      turns.push(turn)
      const action = actions.shift()
      if (action === undefined) throw new Error('script ran out')
      return action
    },
  }
}

const clock = () => new Date('2026-11-01T10:00:00Z')
const session = (page: FakePage) =>
  new JourneySession(
    'Find the price of the Pro plan',
    'https://acme.example/',
    'Scripted test model',
    page,
    clock,
  )

describe('a journey with the user’s model', () => {
  it('finds the answer read-only and records each step', async () => {
    const page = new FakePage()
    const model = scripted([
      { kind: 'click', ref: 'e1' },
      { kind: 'finish', outcome: 'completed_read_only', note: 'Pro costs $49 a month.' },
    ])

    const result = await runJourney(session(page), model)

    expect(result).toMatchObject({
      outcome: 'completed_read_only',
      steps: 1,
      stoppedAt: null,
      agent: 'Scripted test model',
      webMcpApi: 'document.modelContext.getTools()',
      webMcpTools: ['search_products'],
      lastPage: 'Pricing (https://acme.example/pricing)',
    })
    expect(result.trail.map((s) => [s.action.kind, s.target, s.url])).toEqual([
      ['click', 'Pricing', 'https://acme.example/'],
      ['finish', null, 'https://acme.example/pricing'],
    ])
    expect(model.turns[1]?.observation.text).toBe('Pro plan: $49 a month.')
    expect(page.closed).toBe(true)
  })

  it('stops by policy before a final button, and never presses it', async () => {
    const page = new FakePage()
    const model = scripted([
      { kind: 'click', ref: 'e1' },
      { kind: 'click', ref: 'e3' },
    ])

    const result = await runJourney(session(page), model)

    expect(result.outcome).toBe('stopped_by_policy')
    expect(result.stoppedAt).toBe('Step 2: "Buy now" is a final step and is never pressed.')
    expect(result.steps).toBe(1)
    expect(page.performed).toEqual([{ kind: 'click', ref: 'e1' }])
    expect(result.trail[1]?.refused).toBe('"Buy now" is a final step and is never pressed.')
  })

  it('stops by policy at a sign-in link', async () => {
    const page = new FakePage()
    const result = await runJourney(session(page), scripted([{ kind: 'click', ref: 'e2' }]))
    expect(result.outcome).toBe('stopped_by_policy')
    expect(result.stoppedAt).toBe('Step 1: "Log in" starts a sign-in.')
    expect(page.performed).toEqual([])
  })

  it('stops at the step cap', async () => {
    const page = new FakePage()
    const scrolls = Array.from(
      { length: 20 },
      () => ({ kind: 'scroll', direction: 'down' }) as const,
    )

    const result = await runJourney(session(page), scripted(scrolls))

    expect(result.outcome).toBe('stopped_by_policy')
    expect(result.stoppedAt).toBe('Step 15: The 15-step limit was reached.')
    expect(page.performed).toHaveLength(15)
  })

  it('tells the model when a ref does not exist, and counts the step', async () => {
    const page = new FakePage()
    const model = scripted([
      { kind: 'click', ref: 'e99' },
      { kind: 'finish', outcome: 'blocked', note: 'The pricing link has no name.' },
    ])

    const result = await runJourney(session(page), model)

    expect(model.turns[1]?.lastError).toBe('No element has ref e99 on this page.')
    expect(result).toMatchObject({
      outcome: 'blocked',
      steps: 1,
      stoppedAt: 'Step 1: The pricing link has no name.',
    })
  })

  it('stops instead of guessing when the model fails', async () => {
    const page = new FakePage()
    const result = await runJourney(session(page), scripted([]))
    expect(result.outcome).toBe('stopped_by_policy')
    expect(result.stoppedAt).toBe('Step 0: The model failed to choose a step (script ran out).')
    expect(page.closed).toBe(true)
  })

  it('stops when the person presses Stop', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runJourney(session(new FakePage()), scripted([]), controller.signal)
    expect(result.stoppedAt).toBe('Step 0: The person stopped the journey.')
  })
})

describe('a journey driven by the calling agent', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const page = new FakePage()
    const saved: JourneyResult[] = []
    const journeys = bridgeJourneys({
      openPage: async () => page,
      save: async (result) => void saved.push(result),
      newId: () => 'j1',
      now: clock,
    })
    return { page, saved, journeys }
  }

  it('observes, acts under the same policy, and saves the result', async () => {
    const { page, saved, journeys } = setup()

    const start = await journeys.observe({ url: 'https://acme.example/', task: 'Find the price' })
    expect(start).toMatchObject({ done: false, journeyId: 'j1', step: 0, stepsLeft: 15 })

    const next = await journeys.act({ journeyId: 'j1', action: { kind: 'click', ref: 'e1' } })
    expect(next.done ? null : next.observation.title).toBe('Pricing')

    const end = await journeys.act({ journeyId: 'j1', action: { kind: 'click', ref: 'e3' } })
    expect(end.done ? end.result.outcome : null).toBe('stopped_by_policy')
    expect(page.performed).toHaveLength(1)
    expect(saved).toHaveLength(1)
    await expect(journeys.observe({ journeyId: 'j1' })).rejects.toThrow('No open journey')
  })

  it('needs a web URL and a task to start', async () => {
    const { journeys } = setup()
    await expect(journeys.observe({ url: 'https://acme.example/' })).rejects.toThrow('task')
    await expect(journeys.observe({ url: 'file:///etc/passwd', task: 'x' })).rejects.toThrow(
      'http or https',
    )
  })

  it('closes a journey the agent stops calling', async () => {
    const { page, saved, journeys } = setup()
    await journeys.observe({ url: 'https://acme.example/', task: 'Find the price' })
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(page.closed).toBe(true)
    expect(saved[0]?.stoppedAt).toBe(
      'Step 0: The agent stopped calling, so the journey was closed.',
    )
  })
})
