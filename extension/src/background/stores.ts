// The KeyValueStore seams core's vault, spend ledger and response cache need, backed by the
// extension's storage. Small records go to chrome.storage.local; cached answers, which can be
// large, go to IndexedDB.
import type { KeyValueStore } from '@open-agent-ready/core/providers'
import { idbDelete, idbGet, idbSet } from './idb'

export const localStore: KeyValueStore = {
  async get(key) {
    return (await browser.storage.local.get(key))[key]
  },
  set: (key, value) => browser.storage.local.set({ [key]: value }),
  remove: (key) => browser.storage.local.remove(key),
}

export const cacheStore: KeyValueStore = {
  get: (key) => idbGet('cache', key),
  set: (key, value) => idbSet('cache', key, value),
  remove: (key) => idbDelete('cache', key),
}
