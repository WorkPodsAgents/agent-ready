// An agent journey (check AX1): one key task attempted read-only in a scratch tab. The result
// matches WorkPods' BrowserTask evidence, so a journey here reads the same as one in an audit.
import type { JourneyAction } from '@open-agent-ready/core/bridge'

export type { JourneyAction }

/** The agent's own verdict when it finishes; the policy adds stopped_by_policy. */
export type FinishOutcome = Extract<JourneyAction, { kind: 'finish' }>['outcome']
export type Outcome = FinishOutcome | 'stopped_by_policy'

/** A browsing step: every action but finish. */
export type BrowseAction = Exclude<JourneyAction, { kind: 'finish' }>

/** An interactive element as the accessibility tree names it. */
export interface ObservedElement {
  /** Stable for the life of the page: the same element keeps its ref between observations. */
  readonly ref: string
  readonly role: string
  /** The accessible name; empty when the control has none, which is what blocks agents. */
  readonly name: string
  /** The current value of a field, when it has one. */
  readonly value: string | null
  readonly disabled: boolean
}

/** The WebMCP tools a page listed, and the API that answered. */
export interface WebMcpListing {
  /** Such as "document.modelContext.getTools()"; null when no API answered. */
  readonly api: string | null
  /** Tool names as the site gave them: third-party text, never instructions. */
  readonly tools: readonly string[]
}

/** What the agent sees of a page at one step. */
export interface Observation {
  readonly url: string
  readonly title: string
  readonly elements: readonly ObservedElement[]
  /** Elements beyond the cap were dropped. */
  readonly elementsTruncated: boolean
  /** The page's visible text, cut at the cap. */
  readonly text: string
  /** The full length of the visible text when it was cut; null when it was not. */
  readonly textFullLength: number | null
  readonly webMcp: WebMcpListing
}

/** What the policy needs to know about an element before acting on it, read from the live DOM. */
export interface ActionTarget {
  readonly role: string
  readonly name: string
  readonly tag: string
  /** The input or button type attribute, lower-cased; null when absent. */
  readonly type: string | null
  /** The autocomplete attribute, lower-cased; null when absent. */
  readonly autocomplete: string | null
  /** True when activating it submits a form (a submit button or image input inside a form). */
  readonly submits: boolean
}

export interface JourneyStep {
  /** 1-based. */
  readonly index: number
  readonly action: JourneyAction
  /** The page the step was taken on. */
  readonly url: string
  /** The accessible name of the element acted on; null for navigation, scrolling and finish. */
  readonly target: string | null
  /** Why the policy refused it; null when it ran. */
  readonly refused: string | null
  /** Why it failed to run, such as a ref that no longer exists; null when it ran. */
  readonly error: string | null
}

export interface JourneyResult {
  readonly task: string
  readonly startUrl: string
  readonly outcome: Outcome
  /** Navigations, clicks, fields filled, selections and scrolls that ran. */
  readonly steps: number
  /** Where and why a partial, blocked or policy-stopped journey stopped; null otherwise. */
  readonly stoppedAt: string | null
  /** The model and tool that drove it; the outcome holds for that agent only. */
  readonly agent: string
  readonly webMcpApi: string | null
  readonly webMcpTools: readonly string[]
  /** What the last page showed: its title and URL. */
  readonly lastPage: string
  readonly trail: readonly JourneyStep[]
  readonly startedAt: string
  readonly finishedAt: string
}
