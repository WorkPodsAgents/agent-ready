// The messages the side panel and the service worker send straight to a tab's reader content
// scripts. They never carry a secret: the page only ever gets the prompt text to fill.
import type { ReadAnswer } from './engines'
import type { SerpReading } from './serp/read-serp'

export interface ContentMessages {
  /** The latest answer on the page, or null when the page shows none. */
  'answers:read': { request: Record<string, never>; response: ReadAnswer | null }
  /** Fills the prompt box. `before` is the answer already on the page, to wait past it. */
  'answers:fill': {
    request: { prompt: string }
    response: { filled: boolean; before: string | null }
  }
  /** Waits for the user to send the prompt and the engine to finish answering. */
  'answers:await': {
    request: { before: string | null; timeoutMs: number }
    response: ReadAnswer | null
  }
  /** The results page as the user sees it, or null off a Google results page. */
  'serp:read': { request: Record<string, never>; response: SerpReading | null }
}

export type ContentMessageType = keyof ContentMessages

export interface ContentMessage<T extends ContentMessageType = ContentMessageType> {
  readonly type: T
  readonly payload: ContentMessages[T]['request']
}

export function isContentMessage<T extends ContentMessageType>(
  message: unknown,
  type: T,
): message is ContentMessage<T> {
  return (
    typeof message === 'object' && message !== null && 'type' in message && message.type === type
  )
}
