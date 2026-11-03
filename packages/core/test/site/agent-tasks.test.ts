import { describe, expect, it } from 'vitest'
import { agentTasksFinding, type TaskAttempt } from '../../src/site'

const attempt = (task: string, outcome: TaskAttempt['outcome']): TaskAttempt => ({
  task,
  outcome,
  stoppedAt: outcome === 'completed_read_only' ? null : 'Step 3: no price shown.',
})

describe('key tasks an agent cannot complete (AX1)', () => {
  it('has nothing to judge before any journey runs', () => {
    expect(agentTasksFinding([]).status).toBe('not_applicable')
  })

  it('passes when every task completes or reaches the step our rules stop at', () => {
    const found = agentTasksFinding([
      attempt('Find the price', 'completed_read_only'),
      attempt('Request a quote', 'stopped_by_policy'),
    ])
    expect([found.layer, found.status, found.severity]).toEqual(['axo', 'pass', null])
  })

  it('fires on a partial or blocked task and cites only those', () => {
    const found = agentTasksFinding([
      attempt('Find the price', 'partial'),
      attempt('Request a quote', 'stopped_by_policy'),
    ])
    expect(found).toMatchObject({
      status: 'fail',
      severity: 'high',
      summary: 'An agent could not finish 1 of 2 key tasks.',
      evidence: [{ value: 'Find the price', note: 'partial: Step 3: no price shown.' }],
    })
  })

  it('is critical when every task is blocked', () => {
    const found = agentTasksFinding([attempt('Find the price', 'blocked')])
    expect(found.severity).toBe('critical')
  })
})
