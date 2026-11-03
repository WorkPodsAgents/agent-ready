import { describe, expect, it } from 'vitest'
import { capVerdict, formatUsd } from '../../src/shared/cost'

describe('the cost chip', () => {
  it('shows a tenth of a cent below a dime and cents above', () => {
    expect(formatUsd(0)).toBe('$0')
    expect(formatUsd(0.0241)).toBe('$0.024')
    expect(formatUsd(1.5)).toBe('$1.50')
  })

  it('refuses an action whose estimate passes what is left of the cap', () => {
    const spend = { capUsd: 1, spentUsd: 0.9, reservedUsd: 0.05 }
    expect(capVerdict(0.04, spend)).toEqual({ kind: 'fits', remainingUsd: expect.closeTo(0.05) })
    expect(capVerdict(0.06, spend).kind).toBe('over')
  })

  it('refuses every paid action until a cap is set', () => {
    expect(capVerdict(0.01, { capUsd: null, spentUsd: 0, reservedUsd: 0 })).toEqual({
      kind: 'no_cap',
    })
  })
})
