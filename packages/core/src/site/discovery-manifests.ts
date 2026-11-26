// Checks the discovery documents an agent reads before it calls a site's APIs, skills or MCP
// server against exactly what their standards require, as agent-manifests.ts does for the AI
// catalog and the cards. Sources:
// - API catalog: RFC 9727 section 4 (application/linkset+json holding hyperlinks to the APIs),
//   in the Linkset format of RFC 9264 section 4.2 (a linkset array of link context objects, an
//   anchor that is a string, and each relation an array of target objects with an href).
// - Agent skills index: cloudflare/agent-skills-discovery-rfc v0.2.0 (the 0.2.0 $schema, a skills
//   array, and per skill a name of 1 to 64 lowercase letters, digits and single hyphens, a type
//   of skill-md or archive, a description of at most 1,024 characters, a url and a sha256 digest
//   of 64 lowercase hex characters). Artifacts are never downloaded, so digests are not verified.
// - OAuth Protected Resource Metadata: RFC 9728 sections 2, 3.1 and 3.3 (a resource identical to
//   the identifier the well-known path was built from), with the MCP authorization spec's rule
//   that the metadata names at least one authorization server.
import { Checks, isObject, notJson, parseObject, stringOf, type Json } from './agent-manifests'
import type { FileProblem } from './file-problem'

export const LINKSET_TYPE = 'application/linkset+json'
const SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
const SKILL_NAME = /^(?=.{1,64}$)[a-z0-9]+(-[a-z0-9]+)*$/
const SKILL_TYPE = /^(skill-md|archive)$/
const SKILL_DESCRIPTION = /^[\s\S]{1,1024}$/
const DIGEST = /^sha256:[0-9a-f]{64}$/
const PRM_PATH = '/.well-known/oauth-protected-resource'

/** `type`: the answer's media type without parameters; null when it named none. */
export function checkApiCatalog(text: string, type: string | null): FileProblem[] {
  const root = parseObject(text)
  if (root === null) return [notJson()]
  const checks = new Checks()
  if (type !== LINKSET_TYPE) checks.add({ code: 'invalid_media_type', field: null })
  const linkset = root['linkset']
  if (!Array.isArray(linkset)) {
    checks.missing('linkset')
    return checks.found
  }
  let targets = 0
  linkset.forEach((context: unknown, i) => {
    const at = `linkset[${i}]`
    if (!isObject(context)) checks.invalid(at)
    else targets += linkContext(context, at, checks)
  })
  // An API catalog MUST include hyperlinks to API endpoints (RFC 9727 section 4.1).
  if (targets === 0) checks.missing('linkset')
  return checks.found
}

/** Checks one link context object; returns how many link targets it holds. */
function linkContext(context: Json, at: string, checks: Checks): number {
  let targets = 0
  for (const [relation, value] of Object.entries(context)) {
    if (relation === 'anchor') {
      if (stringOf(value) === null) checks.invalid(`${at}.anchor`)
      continue
    }
    if (!Array.isArray(value)) {
      checks.invalid(`${at}.${relation}`)
      continue
    }
    value.forEach((target: unknown, j) => {
      const where = `${at}.${relation}[${j}]`
      if (!isObject(target)) checks.invalid(where)
      else if (checks.text(target, where, 'href') !== null) targets++
    })
  }
  return targets
}

export function checkSkillsIndex(text: string): FileProblem[] {
  const root = parseObject(text)
  if (root === null) return [notJson()]
  const checks = new Checks()
  const schema = root['$schema']
  if (schema === undefined) checks.missing('$schema')
  // An index under another $schema may be shaped differently, so its skills are not judged.
  else if (schema !== SKILLS_SCHEMA) {
    checks.invalid('$schema')
    return checks.found
  }
  const skills = root['skills']
  if (!Array.isArray(skills)) {
    checks.missing('skills')
    return checks.found
  }
  skills.forEach((skill: unknown, i) => {
    const at = `skills[${i}]`
    if (!isObject(skill)) {
      checks.invalid(at)
      return
    }
    checks.matches(skill, at, 'name', SKILL_NAME)
    checks.matches(skill, at, 'type', SKILL_TYPE)
    checks.matches(skill, at, 'description', SKILL_DESCRIPTION)
    checks.text(skill, at, 'url')
    checks.matches(skill, at, 'digest', DIGEST)
  })
  return checks.found
}

/** Where a protected resource's metadata is read, with the resource values it may name. */
export interface ProtectedResourceRead {
  readonly url: string
  readonly resources: readonly string[]
}

/**
 * For an MCP endpoint, its metadata URL with the well-known path inserted before the endpoint's
 * path (RFC 9728 section 3.1), then the origin's own, which the MCP authorization spec also has
 * clients try. Each names the resource its metadata must carry (section 3.3); the origin's may
 * name the origin or the endpoint.
 */
export function protectedResourceReads(endpoint: string): ProtectedResourceRead[] {
  const url = new URL(endpoint)
  url.hash = ''
  const origin = url.origin
  const resource = url.href
  const suffix = `${url.pathname === '/' ? '' : url.pathname}${url.search}`
  const root = { url: `${origin}${PRM_PATH}`, resources: [origin, `${origin}/`, resource] }
  return suffix === ''
    ? [root]
    : [{ url: `${origin}${PRM_PATH}${suffix}`, resources: [resource] }, root]
}

export function checkProtectedResource(text: string, resources: readonly string[]): FileProblem[] {
  const root = parseObject(text)
  if (root === null) return [notJson()]
  const checks = new Checks()
  const resource = checks.text(root, null, 'resource')
  if (resource !== null && !resources.includes(resource)) checks.invalid('resource')
  const servers = checks.list(root, null, 'authorization_servers')
  servers?.forEach((server, i) => {
    if ((stringOf(server)?.trim() ?? '') === '') checks.invalid(`authorization_servers[${i}]`)
  })
  return checks.found
}
