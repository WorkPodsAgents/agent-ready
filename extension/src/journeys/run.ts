import type { JourneyModel } from './models/model'
import { MAX_STEPS } from './outcome'
import type { JourneySession } from './session'
import type { JourneyResult } from './types'

/**
 * Drives a journey with the user's own model until the model finishes or the session ends it.
 * A failed model call stops the journey instead of guessing an action.
 */
export async function runJourney(
  session: JourneySession,
  model: JourneyModel,
  signal?: AbortSignal,
): Promise<JourneyResult> {
  let observation = await session.observe()
  let lastError: string | null = null
  for (;;) {
    if (signal?.aborted === true) return session.stop('The person stopped the journey.')
    let action
    try {
      action = await model.next({
        task: session.task,
        observation,
        trail: session.trail,
        stepsLeft: MAX_STEPS - session.stepsTaken,
        lastError,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'no answer'
      return session.stop(`The model failed to choose a step (${reason}).`)
    }
    const outcome = await session.act(action)
    if (outcome.done) return outcome.result
    observation = outcome.observation
    lastError = outcome.error
  }
}
