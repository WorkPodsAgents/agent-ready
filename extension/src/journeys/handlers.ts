import type { ToolArgs } from '@open-agent-ready/core/bridge'
import type { registerHandler as RegisterHandler } from '../background/router'
import { vault } from '../background/vault'
import { trusted } from '../background/handle'
import { bridgeJourneys } from './bridge-journeys'
import { journeyHistory, saveJourney } from './history'
import { chromeModelAvailable, modelFor, SOURCE_SECRET, type ModelSource } from './models'
import { runJourney } from './run'
import { openScratchTab } from './scratch-tab'
import { JourneySession } from './session'
import type { JourneyResult } from './types'

/** The panel's request to run a journey with one of the user's models. */
export interface RunRequest {
  readonly task: string
  readonly startUrl: string
  readonly source: ModelSource
}

export type SourceAvailability = Readonly<Record<ModelSource, boolean>>

const now = () => new Date()

export function registerJourneyHandlers(registerHandler: typeof RegisterHandler): void {
  const bridge = bridgeJourneys({
    openPage: openScratchTab,
    save: saveJourney,
    newId: () => crypto.randomUUID(),
    now,
  })
  // One panel journey at a time: each holds a scratch tab.
  let running: AbortController | null = null

  registerHandler(
    'tool:journey_observe',
    trusted((payload) => bridge.observe(payload as ToolArgs['journey_observe'])),
  )
  registerHandler(
    'tool:journey_act',
    trusted((payload) => bridge.act(payload as ToolArgs['journey_act'])),
  )

  registerHandler(
    'journeys:run',
    trusted(async (payload): Promise<JourneyResult> => {
      const request = payload as RunRequest
      if (running !== null) throw new Error('A journey is already running. Stop it first.')
      const key =
        request.source === 'chrome' ? null : await vault.get(SOURCE_SECRET[request.source])
      const model = modelFor(request.source, key, fetch.bind(globalThis))
      const controller = new AbortController()
      running = controller
      try {
        const page = await openScratchTab(request.startUrl)
        const session = new JourneySession(request.task, request.startUrl, model.agent, page, now)
        const result = await runJourney(session, model, controller.signal)
        await saveJourney(result)
        return result
      } finally {
        running = null
      }
    }),
  )

  registerHandler(
    'journeys:stop',
    trusted(async () => {
      running?.abort()
      return null
    }),
  )

  registerHandler(
    'journeys:history',
    trusted(() => journeyHistory()),
  )

  registerHandler(
    'journeys:sources',
    trusted(async (): Promise<SourceAvailability> => {
      const unlocked = await vault.isUnlocked()
      const has = async (source: keyof typeof SOURCE_SECRET) =>
        unlocked && (await vault.has(SOURCE_SECRET[source]))
      return {
        anthropic: await has('anthropic'),
        openai: await has('openai'),
        gemini: await has('gemini'),
        chrome: await chromeModelAvailable(),
      }
    }),
  )
}
