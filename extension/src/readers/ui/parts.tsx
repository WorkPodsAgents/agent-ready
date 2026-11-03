import { useEffect, useState, type ReactNode } from 'react'
import { browser } from 'wxt/browser'
import styles from './ui.module.css'

export type Tone = 'good' | 'info' | 'warn' | 'bad' | 'neutral'

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}

export function Button(props: {
  kind?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[props.kind ?? 'secondary']}`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export function Section(props: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.spread}>
        <h2 className={styles.title}>{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  return error === null ? null : (
    <p className={styles.error} role="alert">
      {error}
    </p>
  )
}

export interface OpenTab {
  readonly id: number
  readonly url: string
}

/** The tab the user is looking at, kept current as they switch or navigate. */
export function useActiveTab(): OpenTab | null {
  const [tab, setTab] = useState<OpenTab | null>(null)
  useEffect(() => {
    const read = () =>
      void browser.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
        setTab(
          active?.id === undefined || active.url === undefined
            ? null
            : { id: active.id, url: active.url },
        )
      })
    read()
    browser.tabs.onActivated.addListener(read)
    browser.tabs.onUpdated.addListener(read)
    return () => {
      browser.tabs.onActivated.removeListener(read)
      browser.tabs.onUpdated.removeListener(read)
    }
  }, [])
  return tab
}

/** Runs an async action, keeping its busy state and its error for the UI. */
export function useAction(): {
  busy: boolean
  error: string | null
  run: (action: () => Promise<void>) => void
} {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    action()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }
  return { busy, error, run }
}

/** Saves `text` as a file through a temporary link; nothing leaves the device. */
export function download(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
