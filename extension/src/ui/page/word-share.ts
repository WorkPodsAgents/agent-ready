import type { AiView } from '../../shared/results'

/**
 * The share of the rendered page's words an AI fetcher gets without running scripts, as a whole
 * percent capped at 100; null when there is no rendered page or it has no words.
 */
export function wordShare(view: AiView): number | null {
  if (view.renderedWords === null || view.renderedWords === 0) return null
  return Math.min(100, Math.round((view.rawWords / view.renderedWords) * 100))
}
