import { browser } from 'wxt/browser'
import { localStore } from '../background/stores'
import type { JourneyResult } from './types'

// Finished journeys, newest first, kept on this device for the step replay.
const KEY = 'journeys'
const KEEP = 50

export async function journeyHistory(): Promise<JourneyResult[]> {
  const stored = await localStore.get(KEY)
  return Array.isArray(stored) ? (stored as JourneyResult[]) : []
}

export async function saveJourney(result: JourneyResult): Promise<void> {
  const kept = [result, ...(await journeyHistory())].slice(0, KEEP)
  await localStore.set(KEY, kept)
}

/**
 * Calls `onChange` whenever a journey is saved, including one an agent ran over the bridge while
 * the panel was open. Returns the unsubscribe.
 */
export function watchJourneys(onChange: () => void): () => void {
  if (import.meta.env.FIREFOX) {
    const listener = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'target' in message &&
        message.target === 'private-storage' &&
        'key' in message &&
        message.key === KEY
      )
        onChange()
    }
    browser.runtime.onMessage.addListener(listener)
    return () => browser.runtime.onMessage.removeListener(listener)
  }
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && KEY in changes) onChange()
  }
  browser.storage.onChanged.addListener(listener)
  return () => browser.storage.onChanged.removeListener(listener)
}
