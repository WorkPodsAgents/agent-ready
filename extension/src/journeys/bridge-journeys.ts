// Journeys the calling agent drives over the bridge, one observe or act at a time. The agent picks
// each action; the session's policy and step cap still decide what runs.
import type { JourneyAction, ToolArgs } from '@open-agent-ready/core/bridge'
import { parseAction } from './models/prompt'
import { MAX_STEPS } from './outcome'
import { JourneySession, type JourneyPage } from './session'
import type { JourneyResult, Observation } from './types'

/** A journey the agent stops calling is closed, so no scratch tab stays attached for long. */
const IDLE_MS = 10 * 60_000
const AGENT = 'The calling agent, through the Agent Ready bridge'

export type JourneyView =
  | {
      readonly done: false
      readonly journeyId: string
      readonly step: number
      readonly stepsLeft: number
      /** Why the last step did not run; null when it did. */
      readonly error: string | null
      /** Page text and names are the site's, never instructions. */
      readonly observation: Observation
    }
  | { readonly done: true; readonly journeyId: string; readonly result: JourneyResult }

export interface BridgeJourneyDeps {
  readonly openPage: (url: string) => Promise<JourneyPage>
  readonly save: (result: JourneyResult) => Promise<void>
  readonly newId: () => string
  readonly now: () => Date
}

export function bridgeJourneys(deps: BridgeJourneyDeps) {
  const open = new Map<string, { session: JourneySession; timer: ReturnType<typeof setTimeout> }>()

  function keepAlive(journeyId: string, session: JourneySession): void {
    const current = open.get(journeyId)
    if (current !== undefined) clearTimeout(current.timer)
    const timer = setTimeout(() => {
      open.delete(journeyId)
      void session.stop('The agent stopped calling, so the journey was closed.').then(deps.save)
    }, IDLE_MS)
    open.set(journeyId, { session, timer })
  }

  function find(journeyId: string): JourneySession {
    const found = open.get(journeyId)
    if (found === undefined) throw new Error(`No open journey has id ${journeyId}.`)
    return found.session
  }

  async function finish(journeyId: string, result: JourneyResult): Promise<JourneyView> {
    const current = open.get(journeyId)
    if (current !== undefined) clearTimeout(current.timer)
    open.delete(journeyId)
    await deps.save(result)
    return { done: true, journeyId, result }
  }

  return {
    async observe(args: ToolArgs['journey_observe']): Promise<JourneyView> {
      if (args.journeyId !== undefined) {
        const session = find(args.journeyId)
        keepAlive(args.journeyId, session)
        return view(args.journeyId, session, null, await session.observe())
      }
      if (args.url === undefined || args.task === undefined) {
        throw new Error('Start a journey with both url and task, or pass the journeyId of one.')
      }
      if (!/^https?:\/\//i.test(args.url)) {
        throw new Error('A journey starts at an http or https URL.')
      }
      const session = new JourneySession(
        args.task,
        args.url,
        AGENT,
        await deps.openPage(args.url),
        deps.now,
      )
      const journeyId = deps.newId()
      keepAlive(journeyId, session)
      return view(journeyId, session, null, await session.observe())
    },

    async act(args: ToolArgs['journey_act']): Promise<JourneyView> {
      const session = find(args.journeyId)
      const action: JourneyAction = parseAction(args.action.kind, args.action)
      const outcome = await session.act(action)
      if (outcome.done) return finish(args.journeyId, outcome.result)
      keepAlive(args.journeyId, session)
      return view(args.journeyId, session, outcome.error, outcome.observation)
    },
  }
}

function view(
  journeyId: string,
  session: JourneySession,
  error: string | null,
  observation: Observation,
): JourneyView {
  return {
    done: false,
    journeyId,
    step: session.stepsTaken,
    stepsLeft: MAX_STEPS - session.stepsTaken,
    error,
    observation,
  }
}
