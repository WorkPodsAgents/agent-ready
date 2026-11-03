// The link to the local MCP bridge. The extension connects out to the bridge on 127.0.0.1 when the
// user turns on "Agent connection"; the bridge accepts only this extension's origin. Each request
// runs the router's `tool:<name>` handler, which works from the user's own connections, so no
// credential crosses the socket.
import { BRIDGE_PORT, type BridgeRequest, type BridgeResponse } from '@open-agent-ready/core/bridge'
import type { LinkState } from '../shared/settings'
import { errorText } from './messages'
import { dispatch } from './router'

const RETRY_ALARM = 'bridge-retry'
/** Chrome runs alarms no sooner than 30 seconds apart; retries back off to ten minutes. */
const RETRY_MINUTES = [0.5, 1, 2, 5, 10]
/**
 * Chrome stops an idle service worker after 30 seconds, and socket traffic counts as activity.
 * The bridge drops an answer to no request it sent, so this one keeps the link alive unnoticed.
 */
const KEEPALIVE_MS = 20_000
const KEEPALIVE: BridgeResponse = { id: 'keepalive', ok: true, result: null }

let socket: WebSocket | null = null
let state: LinkState = 'off'
let failures = 0
let keepalive: ReturnType<typeof setInterval> | null = null
let onChange: (state: LinkState) => void = () => undefined

export function linkState(): LinkState {
  return state
}

export function watchLinkState(listener: (state: LinkState) => void): void {
  onChange = listener
}

/** Opens or closes the link to match the setting; safe to call on every service worker start. */
export async function syncBridgeLink(enabled: boolean): Promise<void> {
  if (!enabled) {
    await browser.alarms.clear(RETRY_ALARM)
    failures = 0
    socket?.close()
    socket = null
    setState('off')
    return
  }
  if (socket === null) connect()
}

/** Registered at the top level, so an alarm that wakes the service worker still reconnects. */
export function listenForRetries(isEnabled: () => Promise<boolean>): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RETRY_ALARM) return
    void isEnabled().then((enabled) => syncBridgeLink(enabled))
  })
}

function connect(): void {
  setState('connecting')
  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`)
  socket = ws
  ws.onopen = () => {
    failures = 0
    setState('connected')
    keepalive = setInterval(() => ws.send(JSON.stringify(KEEPALIVE)), KEEPALIVE_MS)
  }
  ws.onmessage = (event) => void answer(ws, String(event.data))
  ws.onclose = () => {
    if (keepalive !== null) clearInterval(keepalive)
    keepalive = null
    if (socket !== ws) return
    socket = null
    // The bridge runs only while an agent uses it, so a closed link waits for the next one.
    const delayInMinutes = RETRY_MINUTES[Math.min(failures, RETRY_MINUTES.length - 1)] ?? 10
    failures += 1
    void browser.alarms.create(RETRY_ALARM, { delayInMinutes })
    setState('waiting')
  }
}

async function answer(ws: WebSocket, data: string): Promise<void> {
  const request = parseRequest(data)
  if (request === null) return
  let response: BridgeResponse
  try {
    const result = await dispatch(`tool:${request.tool}`, request.args, null)
    response = { id: request.id, ok: true, result }
  } catch (error) {
    response = { id: request.id, ok: false, error: errorText(error) }
  }
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(response))
}

function parseRequest(data: string): BridgeRequest | null {
  try {
    const value: unknown = JSON.parse(data)
    if (typeof value !== 'object' || value === null) return null
    if (!('id' in value) || typeof value.id !== 'string') return null
    if (!('tool' in value) || typeof value.tool !== 'string' || !('args' in value)) return null
    // The tool handler checks its own arguments; an unknown tool fails in dispatch.
    return value as BridgeRequest
  } catch {
    return null
  }
}

function setState(next: LinkState): void {
  if (next === state) return
  state = next
  onChange(next)
}
