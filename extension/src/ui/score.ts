import type { Finding, Layer } from '@open-agent-ready/core'
import type { LayerScore } from '../shared/results'

/** The layers the score strip shows; ACO has no checks yet and is shown as coming later. */
export const SCORED_LAYERS: readonly Layer[] = ['seo', 'geo', 'axo']

/**
 * Each layer's checks that passed over those that could be judged. A partial counts as not
 * passed. A check that is not applicable is counted apart as untested: most sites have no WebMCP
 * tools or agent manifests, and leaving those out alone made a bare AXO layer look perfect.
 */
export function layerScores(findings: readonly Finding[]): LayerScore[] {
  return SCORED_LAYERS.map((layer) => {
    const inLayer = findings.filter((f) => f.layer === layer)
    const judged = inLayer.filter((f) => f.status !== 'not_applicable')
    return {
      layer,
      passed: judged.filter((f) => f.status === 'pass').length,
      judged: judged.length,
      untested: inLayer.length - judged.length,
    }
  })
}

/**
 * "8 of 11" over every check in the layer, untested ones included, so a layer judged on two of
 * five checks never reads as complete. Null when the layer has no checks.
 */
export function scoreText(score: LayerScore): string | null {
  const total = score.judged + score.untested
  return total === 0 ? null : `${score.passed} of ${total}`
}
