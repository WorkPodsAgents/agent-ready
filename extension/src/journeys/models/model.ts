import type { JourneyAction, JourneyStep, Observation } from '../types'

/** What the model is shown at each step. */
export interface ModelTurn {
  readonly task: string
  readonly observation: Observation
  readonly trail: readonly JourneyStep[]
  readonly stepsLeft: number
  /** Why the previous step did not run; null when it did. */
  readonly lastError: string | null
}

/** A model that picks the next action. Each provider client is one implementation. */
export interface JourneyModel {
  /** Recorded as the result's agent, such as "Claude (claude-sonnet-5-5) via Agent Ready". */
  readonly agent: string
  next(turn: ModelTurn): Promise<JourneyAction>
}
