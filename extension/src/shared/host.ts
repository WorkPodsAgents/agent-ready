/** The host without a leading www., which is how people name their site. */
export function bareHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

/**
 * The grant a check asks for: the site and its subdomains on any scheme, so the common redirects
 * (http to https, apex to www) stay inside what the user allowed.
 */
export function sitePattern(url: string): string {
  return `*://*.${bareHost(url)}/*`
}

/** Accepts "example.com" as well as a full URL, the way people type a site. */
export function toUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

/** Two URLs name the same document when they differ only in the fragment. */
export function sameDocument(a: string, b: string): boolean {
  return a.split('#')[0] === b.split('#')[0]
}

/** API permissions asked for with each site grant: webRequest reads the redirects of a check. */
export const SITE_PERMISSIONS = ['webRequest'] as const
