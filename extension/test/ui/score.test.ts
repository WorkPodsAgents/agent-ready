import type { Finding, Layer, Status } from '@open-agent-ready/core'
import { describe, expect, it } from 'vitest'
import { layerScores, scoreText } from '../../src/ui/score'

function finding(layer: Layer, status: Status): Finding {
  return {
    checkId: 'missing_title',
    layer,
    group: 'title_meta',
    status,
    severity: status === 'pass' || status === 'not_applicable' ? null : 'high',
    summary: 'A finding.',
    evidence: [],
  }
}

describe('the score strip', () => {
  it('counts passes over judged checks and not applicable checks as untested', () => {
    const scores = layerScores([
      finding('seo', 'pass'),
      finding('seo', 'pass'),
      finding('seo', 'partial'),
      finding('seo', 'fail'),
      finding('seo', 'not_applicable'),
      finding('geo', 'not_applicable'),
      finding('axo', 'pass'),
    ])
    expect(scores).toEqual([
      { layer: 'seo', passed: 2, judged: 4, untested: 1 },
      { layer: 'geo', passed: 0, judged: 0, untested: 1 },
      { layer: 'axo', passed: 1, judged: 1, untested: 0 },
    ])
    expect(scores.map(scoreText)).toEqual(['2 of 5', '0 of 1', '1 of 1'])
  })
})
