import { describe, expect, it } from 'vitest'
import { capped, finished, refused, stoppedEarly } from '../../src/journeys/outcome'

describe('journey outcomes', () => {
  it('names no stopping point when the task was done or reached its final step', () => {
    expect(finished('completed_read_only', 'Pro costs $49 a month.', 3)).toEqual({
      outcome: 'completed_read_only',
      stoppedAt: null,
    })
    expect(finished('reached_confirmation', 'The Confirm button is on screen.', 6)).toEqual({
      outcome: 'reached_confirmation',
      stoppedAt: null,
    })
  })

  it('says where and why a partial or blocked task stopped', () => {
    expect(finished('partial', "The quote form's Next button has no name.", 4)).toEqual({
      outcome: 'partial',
      stoppedAt: "Step 4: The quote form's Next button has no name.",
    })
    expect(finished('blocked', '  ', 0)).toEqual({
      outcome: 'blocked',
      stoppedAt: 'Step 0: The agent gave no reason.',
    })
  })

  it('maps a refusal, the step cap and an early stop to stopped_by_policy', () => {
    expect(refused({ class: 'final_button', reason: '"Pay now" is a final step.' }, 7)).toEqual({
      outcome: 'stopped_by_policy',
      stoppedAt: 'Step 7: "Pay now" is a final step.',
    })
    expect(capped(15)).toEqual({
      outcome: 'stopped_by_policy',
      stoppedAt: 'Step 15: The 15-step limit was reached.',
    })
    expect(stoppedEarly('The person stopped the journey.', 2).outcome).toBe('stopped_by_policy')
  })
})
