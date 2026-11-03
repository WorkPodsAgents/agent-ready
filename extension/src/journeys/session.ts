// One journey in progress. The calling agent (over the bridge) and the built-in loop (with the
// user's model) both drive it through observe and act, so the policy and the step cap hold
// whoever chooses the actions.
import { capped, finished, MAX_STEPS, refused, stoppedEarly, type Ending } from './outcome'
import { refusalFor } from './policy'
import type {
  ActionTarget,
  BrowseAction,
  JourneyAction,
  JourneyResult,
  JourneyStep,
  Observation,
} from './types'

/** The scratch tab as a journey sees it; tests replace it with a scripted page. */
export interface JourneyPage {
  observe(): Promise<Observation>
  /** The live element behind `ref`, or null when the page no longer has it. */
  describe(ref: string): Promise<ActionTarget | null>
  perform(action: BrowseAction): Promise<void>
  close(): Promise<void>
}

export type ActResult =
  | {
      readonly done: false
      readonly step: number
      /** Why the step did not run; null when it did. */
      readonly error: string | null
      readonly observation: Observation
    }
  | { readonly done: true; readonly result: JourneyResult }

const WEB_MCP_TOOL_LIMIT = 50

export class JourneySession {
  private readonly log: JourneyStep[] = []
  private readonly tools = new Set<string>()
  private webMcpApi: string | null = null
  private steps = 0
  private last: Observation | null = null
  private ended: JourneyResult | null = null

  constructor(
    readonly task: string,
    readonly startUrl: string,
    readonly agent: string,
    private readonly page: JourneyPage,
    private readonly now: () => Date,
    private readonly startedAt: Date = now(),
  ) {}

  get result(): JourneyResult | null {
    return this.ended
  }

  get trail(): readonly JourneyStep[] {
    return this.log
  }

  get stepsTaken(): number {
    return this.steps
  }

  async observe(): Promise<Observation> {
    const observation = await this.page.observe()
    this.last = observation
    this.webMcpApi ??= observation.webMcp.api
    for (const tool of observation.webMcp.tools) {
      if (this.tools.size < WEB_MCP_TOOL_LIMIT) this.tools.add(tool)
    }
    return observation
  }

  async act(action: JourneyAction): Promise<ActResult> {
    if (this.ended !== null) return { done: true, result: this.ended }
    const url = this.last?.url ?? this.startUrl
    if (action.kind === 'finish') {
      this.record(action, url, null, null, null)
      return this.end(finished(action.outcome, action.note, this.steps))
    }
    if (this.steps >= MAX_STEPS) return this.end(capped(this.steps))

    const ref = 'ref' in action ? action.ref : null
    const target = ref === null ? null : await this.page.describe(ref)
    const name = target?.name ?? null
    if (ref !== null && target === null) {
      return this.continueWith(action, url, name, `No element has ref ${ref} on this page.`)
    }
    const refusal = refusalFor(action, target)
    if (refusal !== null) {
      this.record(action, url, name, refusal.reason, null)
      return this.end(refused(refusal, this.steps + 1))
    }
    try {
      await this.page.perform(action)
    } catch (error) {
      return this.continueWith(action, url, name, error instanceof Error ? error.message : 'failed')
    }
    return this.continueWith(action, url, name, null)
  }

  /** Ends the journey before the agent finished: the person stopped it, or the model failed. */
  async stop(reason: string): Promise<JourneyResult> {
    if (this.ended !== null) return this.ended
    return (await this.end(stoppedEarly(reason, this.steps))).result
  }

  private async continueWith(
    action: BrowseAction,
    url: string,
    target: string | null,
    error: string | null,
  ): Promise<ActResult> {
    // A step that failed still spent the agent's turn, so it counts toward the cap.
    this.steps += 1
    this.record(action, url, target, null, error)
    return { done: false, step: this.steps, error, observation: await this.observe() }
  }

  private record(
    action: JourneyAction,
    url: string,
    target: string | null,
    refused: string | null,
    error: string | null,
  ): void {
    this.log.push({ index: this.log.length + 1, action, url, target, refused, error })
  }

  private async end(ending: Ending): Promise<{ done: true; result: JourneyResult }> {
    this.ended = this.summary(ending)
    await this.page.close()
    return { done: true, result: this.ended }
  }

  private summary(ending: Ending): JourneyResult {
    const last = this.last
    return {
      task: this.task,
      startUrl: this.startUrl,
      outcome: ending.outcome,
      steps: this.steps,
      stoppedAt: ending.stoppedAt,
      agent: this.agent,
      webMcpApi: this.webMcpApi,
      webMcpTools: [...this.tools],
      lastPage: last === null ? this.startUrl : `${last.title} (${last.url})`,
      trail: [...this.log],
      startedAt: this.startedAt.toISOString(),
      finishedAt: this.now().toISOString(),
    }
  }
}
