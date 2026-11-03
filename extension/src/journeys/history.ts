import { browser } from 'wxt/browser'
import type { JourneyResult } from './types'

// Finished journeys, newest first, kept on this device for the step replay.
const KEY = 'journeys'
const KEEP = 50

export async function journeyHistory(): Promise<JourneyResult[]> {
  const stored = (await browser.storage.local.get(KEY))[KEY]
  return Array.isArray(stored) ? (stored as JourneyResult[]) : []
}

export async function saveJourney(result: JourneyResult): Promise<void> {
  const kept = [result, ...(await journeyHistory())].slice(0, KEEP)
  await browser.storage.local.set({ [KEY]: kept })
}

/**
 * Calls `onChange` whenever a journey is saved, including one an agent ran over the bridge while
 * the panel was open. Returns the unsubscribe.
 */
export function watchJourneys(onChange: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && KEY in changes) onChange()
  }
  browser.storage.onChanged.addListener(listener)
  return () => browser.storage.onChanged.removeListener(listener)
}
