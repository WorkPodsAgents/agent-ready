import { SITE_PERMISSIONS } from '../shared/host'

/** The origin pattern a host permission is granted for. */
export function originPattern(url: string): string {
  return `${new URL(url).origin}/*`
}

/**
 * Network work runs only on sites the user granted. The panel asks for the grant when the user
 * starts the work; the bridge cannot ask, so it gets a message saying where to grant it.
 */
export async function requireHostAccess(url: string): Promise<void> {
  const wanted = { permissions: [...SITE_PERMISSIONS], origins: [originPattern(url)] }
  if (await browser.permissions.contains(wanted)) return
  throw new Error(
    `Agent Ready has no access to ${new URL(url).host} yet. ` +
      'Run a check on that site from the side panel once to allow it.',
  )
}
