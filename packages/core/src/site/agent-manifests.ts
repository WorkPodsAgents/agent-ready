// Checks the JSON manifests agents read against exactly what their pinned standards require,
// ported from WorkPods AgentManifests.kt, so a finding names the field to fix. Optional fields are
// never required. Sources:
// - AI catalog: Agent-Card/ai-catalog specification/ai-catalog.md at 08692c4, the v0.9 release
//   candidate (specVersion "Major.Minor", entries; an entry's identifier and type, and exactly one
//   of url or data; a host, when present, names its displayName). An entry's displayName is
//   optional there (ADR-0016) but required by ARD v0.91 (ards-project/ard-spec
//   spec/schemas/ard-entry.schema.json), so its absence is kept apart as an ARD gap that never
//   decides the catalog's verdict.
// - MCP server card (SEP-2127): modelcontextprotocol/ext-server-card schema.ts at 28db12c, whose
//   rules checked here are unchanged since 526201b.
// - A2A agent card: A2A 1.0.0 a2a.proto, where a required array holds at least one element. A
//   0.x card names its endpoint as url, accepted only on the legacy /.well-known/agent.json path.
import type { FileProblem } from './file-problem'

export type Json = Readonly<Record<string, unknown>>

/** A catalog's problems, and the server card URLs its entries link to, as written. */
export interface CatalogCheck {
  readonly problems: readonly FileProblem[]
  /** Fields ARD v0.91 requires that the AI Catalog spec leaves optional: entry displayNames. */
  readonly ard: readonly FileProblem[]
  readonly cards: readonly string[]
  /** The remote URLs of the server cards the catalog carries inline. */
  readonly remotes: readonly string[]
}

export const SERVER_CARD_TYPE = 'application/mcp-server-card+json'
/** The AI catalog's own media type (AI Catalog v0.9 RC, Media Type). */
export const CATALOG_TYPE = 'application/ai-catalog+json'
const MAX_PROBLEMS = 20
const SPEC_VERSION = /^\d+\.\d+$/
const SCHEMA =
  /^https:\/\/static\.modelcontextprotocol\.io\/schemas\/v1\/server-card\.schema\.json$/
const SERVER_NAME = /^(?=.{3,200}$)[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/
const VERSION = /^[\s\S]{0,255}$/
const DESCRIPTION = /^[\s\S]{1,100}$/
const TRANSPORT = /^(streamable-http|sse)$/
const REMOTE_URL = /^(https?:\/\/\S+|\{[a-zA-Z_][a-zA-Z0-9_]*\}\S*)$/
const INTERFACE_FIELDS = ['url', 'protocolBinding', 'protocolVersion']
const SKILL_FIELDS = ['id', 'name', 'description']

export function checkCatalog(text: string): CatalogCheck {
  const root = parseObject(text)
  if (root === null) return { problems: [notJson()], ard: [], cards: [], remotes: [] }
  const checks = new Checks()
  const ard = new Checks()
  const version = checks.text(root, null, 'specVersion')
  if (version !== null && !SPEC_VERSION.test(version)) checks.invalid('specVersion')
  const host = root['host']
  if (host !== undefined) {
    if (isObject(host)) checks.text(host, 'host', 'displayName')
    else checks.invalid('host')
  }
  const entries = root['entries']
  if (!Array.isArray(entries)) checks.missing('entries')
  const cards: string[] = []
  const remotes: string[] = []
  ;(Array.isArray(entries) ? entries : []).forEach((entry: unknown, i) => {
    const at = `entries[${i}]`
    const card = catalogEntry(entry, at, checks)
    if (isObject(entry)) {
      ard.text(entry, at, 'displayName')
      const data = entry['data']
      if (entry['type'] === SERVER_CARD_TYPE && isObject(data)) remotes.push(...remoteUrls(data))
    }
    if (card !== null) cards.push(card)
  })
  return { problems: checks.found, ard: ard.found, cards: [...new Set(cards)], remotes }
}

/** Checks one entry; returns the card URL it links to, if it does. */
function catalogEntry(entry: unknown, at: string, checks: Checks): string | null {
  if (!isObject(entry)) {
    checks.invalid(at)
    return null
  }
  checks.text(entry, at, 'identifier')
  const card = checks.text(entry, at, 'type') === SERVER_CARD_TYPE
  const url = stringOf(entry['url'])
  const data = entry['data']
  if ((url === null) === (data === undefined)) checks.invalid(`${at}.url`)
  if (card && data !== undefined) {
    if (isObject(data)) serverCard(data, `${at}.data`, checks)
    else checks.invalid(`${at}.data`)
  }
  return card && data === undefined ? url : null
}

/** The remote URLs a server card names, as written, leaving out templated ones. */
export function serverCardRemotes(text: string): string[] {
  const root = parseObject(text)
  return root === null ? [] : remoteUrls(root)
}

function remoteUrls(card: Json): string[] {
  const remotes = card['remotes']
  if (!Array.isArray(remotes)) return []
  return remotes.flatMap((remote: unknown) => {
    const url = isObject(remote) ? stringOf(remote['url']) : null
    return url === null || url.includes('{') ? [] : [url]
  })
}

export function checkServerCard(text: string): FileProblem[] {
  const root = parseObject(text)
  if (root === null) return [notJson()]
  const checks = new Checks()
  serverCard(root, null, checks)
  return checks.found
}

/** `legacy`: read at /.well-known/agent.json, where a 0.x card's url is kept. */
export function checkAgentCard(text: string, legacy: boolean): FileProblem[] {
  const root = parseObject(text)
  if (root === null) return [notJson()]
  const checks = new Checks()
  for (const field of ['name', 'description', 'version']) checks.text(root, null, field)
  if (!isObject(root['capabilities'])) checks.missing('capabilities')
  for (const field of ['defaultInputModes', 'defaultOutputModes']) checks.list(root, null, field)
  const oldUrl = legacy && (stringOf(root['url'])?.trim() ?? '') !== ''
  if (!oldUrl) {
    const interfaces = checks.list(root, null, 'supportedInterfaces')
    if (interfaces !== null) checks.each(interfaces, 'supportedInterfaces', INTERFACE_FIELDS, [])
  }
  const skills = checks.list(root, null, 'skills')
  if (skills !== null) checks.each(skills, 'skills', SKILL_FIELDS, ['tags'])
  return checks.found
}

function serverCard(card: Json, at: string | null, checks: Checks): void {
  checks.matches(card, at, '$schema', SCHEMA)
  checks.matches(card, at, 'name', SERVER_NAME)
  checks.matches(card, at, 'version', VERSION)
  checks.matches(card, at, 'description', DESCRIPTION)
  const remotes = card['remotes']
  if (remotes === undefined) return
  if (!Array.isArray(remotes)) {
    checks.invalid(path(at, 'remotes'))
    return
  }
  remotes.forEach((remote: unknown, i) => {
    const where = path(at, `remotes[${i}]`)
    if (!isObject(remote)) checks.invalid(where)
    else {
      checks.matches(remote, where, 'type', TRANSPORT)
      checks.matches(remote, where, 'url', REMOTE_URL)
    }
  })
}

/** The problems found so far, capped so a broken file stays one finding. */
export class Checks {
  readonly found: FileProblem[] = []

  missing(field: string): void {
    this.add({ code: 'missing_field', field })
  }

  invalid(field: string): void {
    this.add({ code: 'invalid_field', field })
  }

  /** The field when it is a non-blank string; otherwise noted missing. */
  text(json: Json, at: string | null, field: string): string | null {
    const value = stringOf(json[field])
    if (value === null || value.trim() === '') {
      this.missing(path(at, field))
      return null
    }
    return value
  }

  /** The field must be a string the pattern matches whole. */
  matches(json: Json, at: string | null, field: string, pattern: RegExp): void {
    const value = json[field]
    const text = stringOf(value)
    if (value === undefined) this.missing(path(at, field))
    // null, a number, an object or an array is never the string required
    else if (text === null || !pattern.test(text)) this.invalid(path(at, field))
  }

  /** The field as a required array, which must hold an element. */
  list(json: Json, at: string | null, field: string): readonly unknown[] | null {
    const value = json[field]
    const list = Array.isArray(value) ? (value as unknown[]) : null
    if (list === null || list.length === 0) this.missing(path(at, field))
    return list
  }

  /** Each object of the list has the texts and the required arrays. */
  each(
    list: readonly unknown[],
    at: string,
    texts: readonly string[],
    arrays: readonly string[],
  ): void {
    list.forEach((item, i) => {
      const where = `${at}[${i}]`
      if (!isObject(item)) this.invalid(where)
      else {
        texts.forEach((field) => this.text(item, where, field))
        arrays.forEach((field) => this.list(item, where, field))
      }
    })
  }

  add(problem: FileProblem): void {
    if (this.found.length < MAX_PROBLEMS) this.found.push(problem)
  }
}

/** A JSON object, or null when the text is not one. */
export function parseObject(text: string): Json | null {
  try {
    const parsed: unknown = JSON.parse(text.replace(/^﻿/, ''))
    return isObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * The top-level fields each manifest's standard requires: a JSON answer with none of them is no
 * manifest.
 */
export const REQUIRED_FIELDS = {
  ai_catalog: ['specVersion', 'entries'],
  mcp_server_card: ['$schema', 'name', 'version', 'description'],
  a2a_agent_card: [
    'name',
    'description',
    'version',
    'capabilities',
    'supportedInterfaces',
    'defaultInputModes',
    'defaultOutputModes',
    'skills',
  ],
  api_catalog: ['linkset'],
  agent_skills_index: ['$schema', 'skills'],
  oauth_protected_resource: ['resource', 'authorization_servers'],
} as const

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stringOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function path(at: string | null, field: string): string {
  return at === null ? field : `${at}.${field}`
}

export function notJson(): FileProblem {
  return { code: 'not_json', field: null }
}
