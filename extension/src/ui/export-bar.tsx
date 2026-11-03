import { useState } from 'react'
import type { ReportSubject } from '../shared/api'
import type { ExportFormat } from '../shared/results'
import { call, errorText } from './client'
import { Button } from './components/button'
import { ErrorNote } from './components/notice'

const FORMATS: readonly { readonly format: ExportFormat; readonly label: string }[] = [
  { format: 'markdown', label: 'Markdown' },
  { format: 'json', label: 'JSON' },
  { format: 'csv', label: 'CSV' },
]

/** Saves the last result as a file on the user's device; nothing is uploaded. */
export function ExportBar({ subject }: { readonly subject: ReportSubject }) {
  const [error, setError] = useState<string | null>(null)
  const save = async (format: ExportFormat) => {
    try {
      const file = await call('export', { subject, format })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([file.text], { type: file.mime }))
      link.download = file.filename
      link.click()
      URL.revokeObjectURL(link.href)
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    }
  }
  return (
    <>
      {FORMATS.map(({ format, label }) => (
        <Button key={format} variant="ghost" onClick={() => void save(format)}>
          {label}
        </Button>
      ))}
      {error === null ? null : <ErrorNote>{error}</ErrorNote>}
    </>
  )
}
