import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { validateMapping } from '@/lib/mapping/validate'
import { saveMapping } from '@/lib/mapping/storage'
import type { Mapping } from '@/lib/mapping/types'

export interface ImportMappingProps {
  onImport: (mapping: Mapping) => void
}

/**
 * "Import mapping" UI action: accepts pasted JSON, validates it against the
 * hggp block-mapping schema, persists it to localStorage on success, and
 * surfaces a specific error message on failure without touching storage.
 */
export function ImportMapping({ onImport }: ImportMappingProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function importRawText(raw: string) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      setError('Could not parse input as JSON.')
      return
    }

    const result = validateMapping(parsed)
    if (!result.ok) {
      setError(result.error)
      return
    }

    saveMapping(result.mapping)
    setError(null)
    onImport(result.mapping)
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-selecting the same file later
    if (!file) return
    const raw = await file.text()
    setText(raw)
    importRawText(raw)
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Mapping JSON"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-32 rounded-lg border border-input bg-background p-2 text-sm"
      />
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Mapping JSON file"
        onChange={handleFileChange}
      />
      <Button type="button" onClick={() => importRawText(text)}>
        Import mapping
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
