import { useEffect, useRef } from 'react'
import type { Api, ApiReply, ApiType, EventName, Events, PanelEvent } from '../shared/api'
import { SITE_PERMISSIONS, sitePattern } from '../shared/host'

/** Sends one request to the service worker and returns its answer, or throws its message. */
export async function call<K extends ApiType>(
  type: K,
  payload: Api[K]['in'],
): Promise<Api[K]['out']> {
  const reply = (await browser.runtime.sendMessage({ type, payload })) as ApiReply | undefined
  if (reply === undefined) throw new Error('The extension did not answer. Reload it and try again.')
  if (!reply.ok) throw new Error(reply.error)
  // The service worker answers each type from the same Api map.
  return reply.result as Api[K]['out']
}

export function useEvent<E extends EventName>(event: E, listener: (data: Events[E]) => void) {
  const latest = useRef(listener)
  latest.current = listener
  useEffect(() => {
    const onMessage = (message: unknown) => {
      const panelEvent = message as Partial<PanelEvent>
      if (panelEvent.target !== 'panel' || panelEvent.event !== event) return
      latest.current(panelEvent.data as Events[E])
    }
    browser.runtime.onMessage.addListener(onMessage)
    return () => browser.runtime.onMessage.removeListener(onMessage)
  }, [event])
}

/**
 * Asks for access to the sites a check will read. It must run first in a click handler: Chrome
 * shows the prompt only during the user's gesture.
 */
export async function grantSites(...urls: string[]): Promise<void> {
  const origins = [...new Set(urls.map(sitePattern))]
  if (await browser.permissions.request({ permissions: [...SITE_PERMISSIONS], origins })) return
  throw new Error('The check needs access to the site to read it. Allow it to continue.')
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
