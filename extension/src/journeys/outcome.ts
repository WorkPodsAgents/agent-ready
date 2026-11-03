// How a journey's end maps to BrowserTask's outcome and stopped_at. Only partial, blocked and
// policy stops name where they stopped; a found answer or a reached final step needs no reason.
import type { Refusal } from './policy'
import type { FinishOutcome, Outcome } from './types'

export const MAX_STEPS = 15

export interface Ending {
  readonly outcome: Outcome
  readonly stoppedAt: string | null
}

/** The agent said it was done. `steps` is how many steps ran before it said so. */
export function finished(outcome: FinishOutcome, note: string, steps: number): Ending {
  switch (outcome) {
    case 'completed_read_only':
    case 'reached_confirmation':
      return { outcome, stoppedAt: null }
    case 'partial':
    case 'blocked':
      return { outcome, stoppedAt: at(steps, note.trim() || 'The agent gave no reason.') }
  }
}

/** The policy refused the step the agent asked for next. */
export function refused(refusal: Refusal, step: number): Ending {
  return { outcome: 'stopped_by_policy', stoppedAt: at(step, refusal.reason) }
}

/** The agent used every step without finishing. */
export function capped(steps: number): Ending {
  return {
    outcome: 'stopped_by_policy',
    stoppedAt: at(steps, `The ${MAX_STEPS}-step limit was reached.`),
  }
}

/** The journey ended for a reason outside the site, such as the person pressing Stop. */
export function stoppedEarly(reason: string, steps: number): Ending {
  return { outcome: 'stopped_by_policy', stoppedAt: at(steps, reason) }
}

function at(step: number, reason: string): string {
  return `Step ${step}: ${reason}`
}
