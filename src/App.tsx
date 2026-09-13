import { useState } from 'react'
import { ImportMapping } from '@/components/import-mapping'
import { useStoredMapping } from '@/lib/mapping/use-stored-mapping'
import type { Mapping } from '@/lib/mapping/types'

function App() {
  // Restored once from localStorage on mount; a fresh import below overrides
  // it for the rest of the session via `importedMapping`. `mapping` is the
  // one value the rest of the app should read.
  const storedMapping = useStoredMapping()
  const [importedMapping, setImportedMapping] = useState<Mapping | null>(null)
  const mapping = importedMapping ?? storedMapping

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">hggp image renderer</h1>
      <ImportMapping onImport={setImportedMapping} />
      {mapping && <p className="text-sm text-muted-foreground">Mapping loaded.</p>}
    </div>
  )
}

export default App
