// The bridge's side of the link to the extension: a WebSocket server on 127.0.0.1 that only the
// Agent Ready extension may connect to, one at a time. Web pages can open WebSockets to
// localhost too, so the Origin check is what keeps a site the user visits from driving the tools.
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import type {
  BridgeRequest,
  BridgeResponse,
  ToolArgs,
  ToolName,
} from '@open-agent-ready/core/bridge'

export class ExtensionNotConnected extends Error {}

interface Pending {
  readonly resolve: (result: unknown) => void
  readonly reject: (error: Error) => void
  readonly timer: NodeJS.Timeout
}

export interface ExtensionLinkOptions {
  readonly port: number
  readonly allowedOrigin: string
  readonly log: (line: string) => void
}

export class ExtensionLink {
  private readonly server: WebSocketServer
  private extension: WebSocket | null = null
  private readonly pending = new Map<string, Pending>()
  /** Why no extension can connect (another bridge holds the port), or null while listening. */
  private unavailable: string | null = null

  constructor(private readonly options: ExtensionLinkOptions) {
    this.server = new WebSocketServer({
      host: '127.0.0.1',
      port: options.port,
      verifyClient: (info: { origin: string; req: IncomingMessage }, done) => {
        if (info.origin !== options.allowedOrigin) return done(false, 403, 'Forbidden origin')
        if (this.extension !== null) return done(false, 409, 'An extension is already connected')
        done(true)
      },
    })
    this.server.on('connection', (socket) => this.attach(socket))
    this.server.on('error', (error: NodeJS.ErrnoException) => {
      this.unavailable =
        error.code === 'EADDRINUSE'
          ? `port ${options.port} is in use, most likely by another Agent Ready bridge`
          : error.message
      options.log(`Extension link unavailable: ${this.unavailable}`)
    })
  }

  /** Resolves once the server listens, so tests and callers know the port is open. */
  listening(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server.address() !== null) return resolve()
      this.server.once('listening', () => resolve())
    })
  }

  connected(): boolean {
    return this.extension !== null
  }

  /** Sends one tool call to the extension and waits for its answer, or fails after the timeout. */
  call<T extends ToolName>(tool: T, args: ToolArgs[T], timeoutMs: number): Promise<unknown> {
    const extension = this.extension
    if (extension === null) return Promise.reject(new ExtensionNotConnected(this.notConnected()))
    const request: BridgeRequest<T> = { id: randomUUID(), tool, args }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`The extension did not answer ${tool} within ${timeoutMs / 1000} s.`))
      }, timeoutMs)
      this.pending.set(request.id, { resolve, reject, timer })
      extension.send(JSON.stringify(request))
    })
  }

  close(): Promise<void> {
    this.failAll('The bridge is shutting down.')
    return new Promise((resolve) => {
      for (const client of this.server.clients) client.terminate()
      this.server.close(() => resolve())
    })
  }

  private notConnected(): string {
    const reason = this.unavailable === null ? '' : ` (${this.unavailable})`
    return (
      `The Agent Ready extension is not connected${reason}. Open Chrome with the ` +
      'extension installed and turn on Agent connection in its settings, then try again. ' +
      'audit_page, site_files and crawl_site still work without it, and so does the CLI: ' +
      'npx -y @workpods/agent-ready check <url>.'
    )
  }

  private attach(socket: WebSocket): void {
    this.extension = socket
    this.options.log('Extension connected.')
    socket.on('message', (data) => this.settle(String(data)))
    socket.on('close', () => {
      if (this.extension === socket) this.extension = null
      this.failAll('The extension disconnected before it answered.')
      this.options.log('Extension disconnected.')
    })
  }

  private settle(data: string): void {
    const response = parseResponse(data)
    if (response === null)
      return this.options.log('Ignored a malformed message from the extension.')
    const waiting = this.pending.get(response.id)
    if (waiting === undefined) return
    this.pending.delete(response.id)
    clearTimeout(waiting.timer)
    if (response.ok) waiting.resolve(response.result)
    else waiting.reject(new Error(response.error))
  }

  private failAll(reason: string): void {
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timer)
      waiting.reject(new Error(reason))
    }
    this.pending.clear()
  }
}

function parseResponse(data: string): BridgeResponse | null {
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  if (!('id' in value) || typeof value.id !== 'string' || !('ok' in value)) return null
  if (value.ok === true)
    return { id: value.id, ok: true, result: 'result' in value ? value.result : null }
  if (value.ok === false && 'error' in value && typeof value.error === 'string') {
    return { id: value.id, ok: false, error: value.error }
  }
  return null
}
