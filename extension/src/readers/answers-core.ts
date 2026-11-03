// The one place the readers use core's answer scoring, so the panel, the service worker and the
// bridge tool all score with WorkPods' Named / Cited / Absent rules.
import {
  historyCsv,
  scoreAnswer,
  shareOfVoice,
  type AiAnswer,
  type AnswerSource,
  type Party,
  type ScoredAnswer,
} from '@open-agent-ready/core/answers'
import type { ReadAnswer } from './engines'

export type {
  AiAnswer,
  Party,
  ScoredAnswer,
  ShareOfVoice,
  Visibility,
} from '@open-agent-ready/core/answers'
export { historyCsv, shareOfVoice }

/** The brand and its competitors, as the prompt panel or a tool call names them. */
export interface Parties {
  readonly brand: Party
  readonly competitors: readonly Party[]
}

/** A page reading as core's answer. `prompt` falls back to what the page showed. */
export function toAiAnswer(
  read: ReadAnswer,
  source: AnswerSource,
  capturedAt: Date,
  prompt?: string,
): AiAnswer {
  return {
    engine: read.engine,
    prompt: prompt ?? read.prompt ?? '',
    text: read.text,
    citations: read.citations.map((c) =>
      c.title === null ? { url: c.url } : { url: c.url, title: c.title },
    ),
    capturedAt: capturedAt.toISOString(),
    source,
  }
}

export function score(answer: AiAnswer, parties: Parties): ScoredAnswer {
  return scoreAnswer(answer, parties)
}
