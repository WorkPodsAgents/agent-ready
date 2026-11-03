// What the user sets in Settings, and the connection state the header shows.
import type { SpendSummary } from '@open-agent-ready/core/providers'
import type { SecretName } from '@open-agent-ready/core/secrets'

export interface Settings {
  /** How many days a paid answer is reused before it is bought again. */
  readonly cacheDays: number
  /** True when the extension should keep a link open to the local MCP bridge. */
  readonly agentLink: boolean
  /** The user's brand, for the organization identity check. */
  readonly brandName: string | null
}

export const DEFAULT_SETTINGS: Settings = { cacheDays: 7, agentLink: false, brandName: null }

export type VaultState = 'empty' | 'locked' | 'unlocked'

export type LinkState = 'off' | 'connecting' | 'connected' | 'waiting'

/** Everything the header chips and Settings need, without a single secret value. */
export interface Status {
  readonly vault: VaultState
  /** True when the vault key is remembered on this device. */
  readonly remembered: boolean
  /** Which secrets are stored; their values never leave the service worker. */
  readonly stored: readonly SecretName[]
  readonly link: LinkState
  readonly spend: SpendSummary
  readonly settings: Settings
}
