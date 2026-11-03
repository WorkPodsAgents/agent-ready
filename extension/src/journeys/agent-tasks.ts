import { agentTasksFinding } from '@open-agent-ready/core/site'
import type { Finding } from '@open-agent-ready/core'
import { useCallback, useEffect, useState } from 'react'
import { callBackground } from '../readers/background-client'
import { watchJourneys } from './history'
import type { JourneyResult } from './types'

/**
 * AX1 for the open page's site, from the journeys run there: the latest attempt at each task, so
 * a task that failed and was fixed counts as fixed. Null until the history has loaded.
 */
export function useAgentTasks(url: string | null): Finding | null {
  const [history, setHistory] = useState<readonly JourneyResult[] | null>(null)
  const refresh = useCallback(
    () => void callBackground<JourneyResult[]>('journeys:history', {}).then(setHistory),
    [],
  )
  useEffect(() => {
    refresh()
    return watchJourneys(refresh)
  }, [refresh])
  if (history === null || url === null || !/^https?:/.test(url)) return null
  const origin = new URL(url).origin
  const latest = new Map<string, JourneyResult>()
  // History is newest first, so the first result per task is its latest attempt.
  for (const result of history) {
    if (new URL(result.startUrl).origin !== origin) continue
    const task = result.task.trim().toLowerCase()
    if (!latest.has(task)) latest.set(task, result)
  }
  return agentTasksFinding([...latest.values()])
}
