// The saved prompt panel and the answer history, kept in chrome.storage.local on this device.
// Only the extension's own pages and service worker read them: the storage is closed to content
// scripts.
import { browser } from 'wxt/browser'
import type { Parties, ScoredAnswer } from './answers-core'

export interface PromptPanel {
  readonly prompts: readonly string[]
  readonly brand: string
  readonly aliases: readonly string[]
  readonly domains: readonly string[]
  /** Each competitor's name and, when known, its sites. */
  readonly competitors: readonly { readonly name: string; readonly domains: readonly string[] }[]
}

export const MIN_PROMPTS = 5
export const MAX_PROMPTS = 20

const PANEL_KEY = 'answers:panel'
const HISTORY_KEY = 'answers:history'
/** Twenty prompts on six engines, run weekly for about four months. */
const HISTORY_LIMIT = 2000

export const EMPTY_PANEL: PromptPanel = {
  prompts: [],
  brand: '',
  aliases: [],
  domains: [],
  competitors: [],
}

/** What is wrong with a panel before it can run, in plain words; null when it is ready. */
export function panelProblem(panel: PromptPanel): string | null {
  if (panel.brand.trim().length === 0) return 'Add your brand name.'
  const count = panel.prompts.length
  if (count < MIN_PROMPTS) return `Add at least ${MIN_PROMPTS} prompts (you have ${count}).`
  if (count > MAX_PROMPTS) return `Keep it to ${MAX_PROMPTS} prompts (you have ${count}).`
  return null
}

export function partiesOf(panel: PromptPanel): Parties {
  return {
    brand: { name: panel.brand, aliases: panel.aliases, domains: panel.domains },
    competitors: panel.competitors.map((c) => ({ name: c.name, aliases: [], domains: c.domains })),
  }
}

export async function readPanel(): Promise<PromptPanel> {
  const stored = (await browser.storage.local.get(PANEL_KEY))[PANEL_KEY]
  return (stored as PromptPanel | undefined) ?? EMPTY_PANEL
}

export async function savePanel(panel: PromptPanel): Promise<void> {
  await browser.storage.local.set({ [PANEL_KEY]: panel })
}

/** Every scored answer, newest first. */
export async function readHistory(): Promise<ScoredAnswer[]> {
  const stored = (await browser.storage.local.get(HISTORY_KEY))[HISTORY_KEY]
  return Array.isArray(stored) ? (stored as ScoredAnswer[]) : []
}

export async function addToHistory(answer: ScoredAnswer): Promise<void> {
  const kept = [answer, ...(await readHistory())].slice(0, HISTORY_LIMIT)
  await browser.storage.local.set({ [HISTORY_KEY]: kept })
}

export async function clearHistory(): Promise<void> {
  await browser.storage.local.remove(HISTORY_KEY)
}
