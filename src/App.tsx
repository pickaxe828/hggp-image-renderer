import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { ImportMapping } from '@/components/import-mapping'
import { NotationInput } from '@/components/notation-input'
import { useStoredMapping } from '@/lib/mapping/use-stored-mapping'
import type { Mapping } from '@/lib/mapping/types'
import type { Document } from '@/lib/notation'
import { buildScene } from '@/lib/render/build-scene'
import { loadMojangAssets } from '@/lib/assets/mojang-assets'

// three.js + block-model-renderer are large; only pull that bundle in once
// there's actually something to render, not on initial page load.
const SceneViewer = lazy(() =>
  import('@/components/scene-viewer').then((mod) => ({ default: mod.SceneViewer })),
)

function App() {
  // Restored once from localStorage on mount; a fresh import below overrides
  // it for the rest of the session via `importedMapping`. `mapping` is the
  // one value the rest of the app should read.
  const storedMapping = useStoredMapping()
  const [importedMapping, setImportedMapping] = useState<Mapping | null>(null)
  const mapping = importedMapping ?? storedMapping

  const [notationDocument, setNotationDocument] = useState<Document | null>(null)

  const [assets, setAssets] = useState<ArrayBuffer | null>(null)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const assetsRequested = useRef(false)

  useEffect(() => {
    // Defer the (multi-megabyte) Mojang asset fetch until the first
    // successful parse -- a visitor who never pastes anything shouldn't
    // pay for it, and it only ever needs to run once per session.
    if (!notationDocument || assetsRequested.current) return
    assetsRequested.current = true

    let cancelled = false
    loadMojangAssets()
      .then((result) => {
        if (!cancelled) setAssets(result.assets)
      })
      .catch((err: unknown) => {
        if (!cancelled) setAssetsError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [notationDocument])

  const scene = useMemo(() => {
    if (!notationDocument) return null
    try {
      return { blocks: buildScene(notationDocument, mapping), error: null }
    } catch (err) {
      return { blocks: [], error: err instanceof Error ? err.message : String(err) }
    }
  }, [notationDocument, mapping])

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-background p-4 text-foreground">
      <h1 className="text-2xl font-semibold">hggp image renderer</h1>

      <div className="flex w-full max-w-2xl flex-col gap-4">
        <ImportMapping onImport={setImportedMapping} />
        {mapping && <p className="text-sm text-muted-foreground">Mapping loaded.</p>}

        <NotationInput onParsed={setNotationDocument} />

        {assetsError && (
          <p role="alert" className="text-sm text-destructive">
            Could not load Minecraft assets: {assetsError}
          </p>
        )}

        {scene?.error && (
          <p role="alert" className="text-sm text-destructive">
            {scene.error}
          </p>
        )}
      </div>

      {scene && !scene.error && (
        <div className="w-full max-w-4xl">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading 3D viewer…</p>}>
            <SceneViewer blocks={scene.blocks} assets={assets} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default App
