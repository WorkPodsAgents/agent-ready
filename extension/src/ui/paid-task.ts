import type { Paid } from '@open-agent-ready/core/providers'
import { formatUsd } from '../shared/cost'

/** "Cost $0.024", or "From your cache" when the answer was already paid for. */
export function paidNote(paid: Paid<unknown>): string {
  return paid.cached ? 'From your cache, at no cost' : `Cost ${formatUsd(paid.costUsd)}`
}

export function formatCount(value: number | null): string {
  return value === null ? 'n/a' : value.toLocaleString('en-US')
}

/** Splits "a, b" or one per line into trimmed, non-empty entries. */
export function splitList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
}
