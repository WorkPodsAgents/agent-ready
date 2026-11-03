import { describe, expect, it } from 'vitest'
import type { DeviceKeyStore, SessionKeyStore } from '../../src/secrets'
import { createVault, PBKDF2_ITERATIONS } from '../../src/secrets'
import { memoryStore } from '../providers/doubles'

const PASSPHRASE = 'correct horse battery'
const SECRET = 'dfs-password-7f3a91'

function sessionStore(): SessionKeyStore {
  let raw: Uint8Array | null = null
  return {
    get: async () => raw,
    set: async (key) => {
      raw = key
    },
    clear: async () => {
      raw = null
    },
  }
}

function deviceStore(): DeviceKeyStore {
  let key: CryptoKey | null = null
  return {
    get: async () => key,
    set: async (k) => {
      key = k
    },
    clear: async () => {
      key = null
    },
  }
}

function setup() {
  const storage = memoryStore()
  const session = sessionStore()
  const device = deviceStore()
  const options = { storage, sessionKeyStore: session, deviceKeyStore: device, iterations: 1000 }
  return { storage, session, device, vault: createVault(options), options }
}

describe('the vault', () => {
  it('given a secret, when stored, then storage never holds the plaintext', async () => {
    const { vault, storage } = setup()
    await vault.setUp(PASSPHRASE)

    await vault.set('dataforseo_password', SECRET)

    const stored = JSON.stringify([...storage.data.values()])
    expect(stored).not.toContain(SECRET)
    expect(stored).not.toContain(btoa(SECRET))
    expect(stored).not.toContain(PASSPHRASE)
    expect(await vault.get('dataforseo_password')).toBe(SECRET)
    expect(await vault.listConfigured()).toEqual(['dataforseo_password'])
  })

  it('given a new vault, then it derives its key with 600,000 PBKDF2 rounds', async () => {
    const storage = memoryStore()
    const vault = createVault({ storage, sessionKeyStore: sessionStore() })

    await vault.setUp(PASSPHRASE)

    expect(storage.data.get('vault')).toMatchObject({ iterations: PBKDF2_ITERATIONS })
    expect(PBKDF2_ITERATIONS).toBe(600_000)
  })

  it('given a wrong passphrase, when unlocking, then it fails and stays locked', async () => {
    const { vault } = setup()
    await vault.setUp(PASSPHRASE)
    await vault.lock()

    const error = await vault.unlock('wrong passphrase').catch((e: unknown) => e)

    expect(error).toMatchObject({ code: 'wrong_passphrase' })
    expect(String(error)).not.toContain('wrong passphrase')
    expect(await vault.isUnlocked()).toBe(false)
  })

  it('given a locked vault, when a secret is read, then it is refused', async () => {
    const { vault, options } = setup()
    await vault.setUp(PASSPHRASE)
    await vault.set('cloro_key', SECRET)

    await vault.lock()

    await expect(vault.get('cloro_key')).rejects.toMatchObject({ code: 'locked' })
    await expect(vault.set('cloro_key', 'x')).rejects.toMatchObject({ code: 'locked' })
    expect(await vault.has('cloro_key')).toBe(true)
    // A restarted service worker builds a new vault over the same stores.
    const restarted = createVault(options)
    await restarted.unlock(PASSPHRASE)
    expect(await restarted.get('cloro_key')).toBe(SECRET)
  })

  it('given a sealed value moved under another name, when read, then it is refused', async () => {
    const { vault, storage } = setup()
    await vault.setUp(PASSPHRASE)
    await vault.set('cloro_key', SECRET)
    const record = storage.data.get('vault') as { secrets: Record<string, unknown> }
    record.secrets['openai_key'] = record.secrets['cloro_key']

    await expect(vault.get('openai_key')).rejects.toMatchObject({ code: 'corrupt' })
  })

  it('given a new passphrase, then only it unlocks the same secrets', async () => {
    const { vault } = setup()
    await vault.setUp(PASSPHRASE)
    await vault.set('anthropic_key', SECRET)

    await vault.changePassphrase(PASSPHRASE, 'a newer passphrase')
    await vault.lock()

    await expect(vault.unlock(PASSPHRASE)).rejects.toMatchObject({ code: 'wrong_passphrase' })
    await vault.unlock('a newer passphrase')
    expect(await vault.get('anthropic_key')).toBe(SECRET)
  })

  it('given remember on this device, when locked, then the device key unlocks it', async () => {
    const { vault } = setup()
    await vault.setUp(PASSPHRASE)
    await vault.set('gemini_key', SECRET)
    await vault.rememberOnDevice()
    await vault.lock()

    expect(await vault.unlockOnDevice()).toBe(true)
    expect(await vault.get('gemini_key')).toBe(SECRET)

    await vault.forgetDevice()
    await vault.lock()
    expect(await vault.unlockOnDevice()).toBe(false)
  })

  it('given a short passphrase or a second setup, then setup is refused', async () => {
    const { vault } = setup()
    await expect(vault.setUp('short')).rejects.toMatchObject({ code: 'weak_passphrase' })
    await vault.setUp(PASSPHRASE)
    await expect(vault.setUp(PASSPHRASE)).rejects.toMatchObject({ code: 'already_set_up' })
  })

  it('given a wipe, then nothing is left in storage, the session or the device', async () => {
    const { vault, storage, session, device } = setup()
    await vault.setUp(PASSPHRASE)
    await vault.set('openai_key', SECRET)
    await vault.rememberOnDevice()

    await vault.wipe()

    expect(storage.data.size).toBe(0)
    expect(await session.get()).toBeNull()
    expect(await device.get()).toBeNull()
    expect(await vault.isSetUp()).toBe(false)
    expect(await vault.listConfigured()).toEqual([])
  })
})
