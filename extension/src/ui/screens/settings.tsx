import type { Provider } from '@open-agent-ready/core/providers'
import type { SecretName } from '@open-agent-ready/core/secrets'
import { useState } from 'react'
import { formatUsd, PROVIDER_LABEL } from '../../shared/cost'
import type { Settings as SettingsValue, Status } from '../../shared/settings'
import { call, errorText } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { Checkbox, FieldRow, TextField } from '../components/field'
import { ErrorNote, Note } from '../components/notice'
import { sectionId } from '../open-settings'
import { useStatus } from '../status-context'
import styles from './screens.module.css'

const SECRETS: readonly { readonly name: SecretName; readonly label: string }[] = [
  { name: 'dataforseo_login', label: 'DataForSEO login' },
  { name: 'dataforseo_password', label: 'DataForSEO password' },
  { name: 'cloro_key', label: 'Cloro API key' },
  { name: 'anthropic_key', label: 'Anthropic API key' },
  { name: 'openai_key', label: 'OpenAI API key' },
  { name: 'gemini_key', label: 'Gemini API key' },
]

const REMEMBER_TEXT =
  'Remember on this device. This stops someone who copies your browser files, not malware ' +
  'running on this computer.'

const PASSPHRASE_HINT =
  'At least 8 characters. If you forget it, wipe the vault and add your keys again.'

const KEYS_HELP =
  'DataForSEO powers Keywords, Competitors and Links. Cloro runs AI answer checks unattended. ' +
  'A model key (any one) runs Journeys. Saved keys are never shown again.'

const MCP_COMMAND = 'npx @workpods/agent-ready mcp'

/** Runs a settings change and shows its error; the new status arrives as the answer. */
function useChange() {
  const { setStatus } = useStatus()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const change = async (work: () => Promise<Status>) => {
    setBusy(true)
    try {
      setStatus(await work())
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }
  return { change, error, busy }
}

export function Settings() {
  const { status } = useStatus()
  if (status === null) return null
  return (
    <div className={styles.stack}>
      <VaultCard status={status} />
      <KeysCard status={status} />
      <SpendCard status={status} />
      <PreferencesCard settings={status.settings} />
      <AgentCard status={status} />
      <WipeCard />
    </div>
  )
}

function VaultCard({ status }: { readonly status: Status }) {
  const { change, error, busy } = useChange()
  const [passphrase, setPassphrase] = useState('')
  const [repeat, setRepeat] = useState('')
  const [remember, setRemember] = useState(status.remembered)
  const rememberBox = <Checkbox checked={remember} onChange={setRemember} label={REMEMBER_TEXT} />
  const submit = (type: 'vault:setup' | 'vault:unlock') =>
    void change(() => call(type, { passphrase, remember })).then(() => {
      setPassphrase('')
      setRepeat('')
    })
  return (
    <Card
      id={sectionId('vault')}
      title="Key vault"
      subtitle="Your provider keys, encrypted on this device with a passphrase only you know."
      actions={
        <Badge tone={status.vault === 'unlocked' ? 'good' : 'neutral'}>
          {VAULT_LABEL[status.vault]}
        </Badge>
      }
    >
      {status.vault === 'unlocked' ? (
        <FieldRow>
          <Button busy={busy} onClick={() => void change(() => call('vault:lock', {}))}>
            Lock now
          </Button>
          <span className={styles.muted}>
            {status.remembered ? 'Remembered on this device.' : 'Locks when the browser closes.'}
          </span>
        </FieldRow>
      ) : (
        <>
          <TextField
            label="Passphrase"
            type="password"
            autoComplete={status.vault === 'empty' ? 'new-password' : 'current-password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          {status.vault === 'empty' ? (
            <TextField
              label="Repeat the passphrase"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              hint={PASSPHRASE_HINT}
            />
          ) : null}
          {rememberBox}
          {status.vault === 'empty' ? (
            <Button
              variant="primary"
              busy={busy}
              disabled={passphrase.length < 8 || passphrase !== repeat}
              onClick={() => submit('vault:setup')}
            >
              Set up the vault
            </Button>
          ) : (
            <Button
              variant="primary"
              busy={busy}
              disabled={passphrase === ''}
              onClick={() => submit('vault:unlock')}
            >
              Unlock
            </Button>
          )}
        </>
      )}
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}

const VAULT_LABEL = { empty: 'Not set up', locked: 'Locked', unlocked: 'Unlocked' } as const

function KeysCard({ status }: { readonly status: Status }) {
  const { change, error, busy } = useChange()
  const [drafts, setDrafts] = useState<Partial<Record<SecretName, string>>>({})
  const save = (name: SecretName) => {
    const value = drafts[name] ?? ''
    void change(() => call('vault:set', { name, value })).then(() =>
      setDrafts((current) => ({ ...current, [name]: '' })),
    )
  }
  return (
    <Card id={sectionId('keys')} title="Provider keys" subtitle={KEYS_HELP}>
      {status.vault === 'unlocked' ? null : (
        <Note>
          {status.vault === 'empty'
            ? 'Set a passphrase in Key vault above, then add your keys here.'
            : 'Unlock the vault above to add or change keys.'}
        </Note>
      )}
      {SECRETS.map(({ name, label }) => {
        const stored = status.stored.includes(name)
        return (
          <FieldRow key={name}>
            <TextField
              label={label}
              type="password"
              autoComplete="off"
              disabled={status.vault !== 'unlocked'}
              placeholder={stored ? 'Saved' : ''}
              value={drafts[name] ?? ''}
              onChange={(e) => setDrafts((current) => ({ ...current, [name]: e.target.value }))}
            />
            <Button
              busy={busy}
              disabled={status.vault !== 'unlocked' || (drafts[name] ?? '').trim() === ''}
              onClick={() => save(name)}
            >
              Save
            </Button>
            {stored ? (
              <Button
                variant="ghost"
                busy={busy}
                onClick={() => void change(() => call('vault:remove', { name }))}
              >
                Remove
              </Button>
            ) : null}
          </FieldRow>
        )
      })}
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}

function SpendCard({ status }: { readonly status: Status }) {
  const { change, error, busy } = useChange()
  const [caps, setCaps] = useState<Record<Provider, string>>({
    dataforseo: String(status.spend.providers.dataforseo.capUsd ?? ''),
    cloro: String(status.spend.providers.cloro.capUsd ?? ''),
  })
  const providers: readonly Provider[] = ['dataforseo', 'cloro']
  return (
    <Card
      id={sectionId('spend')}
      title="Monthly spend caps"
      subtitle={
        `US dollars for ${status.spend.month}. ` +
        'A paid action that would pass its cap is refused.'
      }
    >
      {providers.map((provider) => {
        const spend = status.spend.providers[provider]
        return (
          <FieldRow key={provider}>
            <TextField
              label={`${PROVIDER_LABEL[provider]} cap · ${formatUsd(spend.spentUsd)} spent`}
              type="number"
              min={0}
              step="0.5"
              value={caps[provider]}
              onChange={(e) => setCaps((current) => ({ ...current, [provider]: e.target.value }))}
            />
            <Button
              busy={busy}
              disabled={caps[provider] === '' || Number(caps[provider]) < 0}
              onClick={() =>
                void change(() => call('spend:cap', { provider, usd: Number(caps[provider]) }))
              }
            >
              Set cap
            </Button>
          </FieldRow>
        )
      })}
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}

function PreferencesCard({ settings }: { readonly settings: SettingsValue }) {
  const { change, error, busy } = useChange()
  const [brand, setBrand] = useState(settings.brandName ?? '')
  const [days, setDays] = useState(String(settings.cacheDays))
  const save = () =>
    void change(() =>
      call('settings:save', {
        settings: {
          ...settings,
          brandName: brand.trim() === '' ? null : brand.trim(),
          cacheDays: Math.max(0, Number(days) || 0),
        },
      }),
    )
  return (
    <Card title="Preferences">
      <TextField
        label="Your brand name"
        hint="Used by the organization identity check and to read AI answers."
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      />
      <TextField
        label="Reuse paid answers for (days)"
        type="number"
        min={0}
        value={days}
        hint="Asking the same question inside this window costs nothing."
        onChange={(e) => setDays(e.target.value)}
      />
      <div>
        <Button busy={busy} onClick={save}>
          Save preferences
        </Button>
      </div>
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}

const LINK_LABEL = {
  off: 'Off',
  connecting: 'Connecting',
  connected: 'Connected',
  waiting: 'Waiting for the bridge',
} as const

function AgentCard({ status }: { readonly status: Status }) {
  const { change, error } = useChange()
  const on = status.settings.agentLink
  return (
    <Card
      id={sectionId('agent')}
      title="Agent connection"
      subtitle="Lets Claude, Codex, Cursor and other agents run these checks through this browser."
      actions={
        <Badge tone={status.link === 'connected' ? 'good' : 'neutral'}>
          {LINK_LABEL[status.link]}
        </Badge>
      }
    >
      <Checkbox
        checked={on}
        onChange={(agentLink) =>
          void change(() => call('settings:save', { settings: { ...status.settings, agentLink } }))
        }
        label="Connect to the local bridge when it runs"
      />
      <Note>Add the bridge to your agent as an MCP server with this command:</Note>
      <code className={styles.mono}>{MCP_COMMAND}</code>
      <Note>
        Agents get results only. Your keys stay in this extension, and paid calls count against your
        caps.
      </Note>
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}

function WipeCard() {
  const { change, error, busy } = useChange()
  const [confirming, setConfirming] = useState(false)
  return (
    <Card
      title="Wipe data"
      subtitle="Deletes the vault, your keys, caps, results and cached answers."
    >
      {confirming ? (
        <FieldRow>
          <Button
            variant="danger"
            busy={busy}
            onClick={() =>
              void change(() => call('data:wipe', {})).then(() => setConfirming(false))
            }
          >
            Wipe everything
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep my data
          </Button>
        </FieldRow>
      ) : (
        <div>
          <Button onClick={() => setConfirming(true)}>Wipe data</Button>
        </div>
      )}
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </Card>
  )
}
