import { DEFAULT_SETTINGS, type Settings } from '../shared/settings'

const KEY = 'settings'

export async function readSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (settings.cacheDays < 0) throw new Error('The cache window cannot be negative.')
  await browser.storage.local.set({ [KEY]: settings })
}
