import type { PageSnapshot } from '@open-agent-ready/core'
import type { AiView } from '../shared/results'

/** How much visible text the "See as AI" view shows for each side. */
export const TEXT_PREVIEW = 4_000

export function aiView(snapshot: PageSnapshot): AiView {
  const raw = visibleText(snapshot.raw)
  const rendered = snapshot.rendered === null ? null : visibleText(snapshot.rendered)
  return {
    rawWords: words(raw),
    renderedWords: rendered === null ? null : words(rendered),
    rawJsonLdTypes: jsonLdTypes(snapshot.raw),
    renderedJsonLdTypes: snapshot.rendered === null ? null : jsonLdTypes(snapshot.rendered),
    rawText: raw.slice(0, TEXT_PREVIEW),
    renderedText: rendered === null ? null : rendered.slice(0, TEXT_PREVIEW),
  }
}

function visibleText(doc: Document): string {
  const body = doc.body?.cloneNode(true)
  if (!(body instanceof HTMLElement)) return ''
  for (const hidden of body.querySelectorAll('script, style, noscript, template, svg')) {
    hidden.remove()
  }
  // Every element breaks a word, as in core's word count; textContent would glue "Skip to
  // content" and the next link's text into one word.
  const parts: string[] = []
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    parts.push(node.textContent ?? '')
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function words(text: string): number {
  return text === '' ? 0 : text.split(' ').length
}

function jsonLdTypes(doc: Document): string[] {
  const types = new Set<string>()
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      collectTypes(JSON.parse(script.textContent ?? ''), types)
    } catch {
      // Invalid JSON-LD has no types to show; the schema check reports it.
    }
  }
  return [...types].sort()
}

function collectTypes(node: unknown, types: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, types)
    return
  }
  if (typeof node !== 'object' || node === null) return
  for (const [key, value] of Object.entries(node)) {
    if (key === '@type') {
      for (const type of [value].flat()) if (typeof type === 'string') types.add(type)
    } else {
      collectTypes(value, types)
    }
  }
}
