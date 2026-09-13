import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { ImportMapping } from '@/components/import-mapping'
import { NotationInput } from '@/components/notation-input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useStoredMapping } from '@/lib/mapping/use-stored-mapping'
import type { Mapping } from '@/lib/mapping/types'
import type { Document } from '@/lib/notation'
import { buildScenes } from '@/lib/render/build-scene'
import type { PlacedScene } from '@/lib/render/types'
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

  // A document can name more than one top-level build; `buildScenes` returns
  // one entry per scene, in document order, and the canvas renders all of
  // them stacked top to bottom.
  const result = useMemo((): { scenes: PlacedScene[]; error: null } | { scenes: null; error: string } => {
    if (!notationDocument) return { scenes: null, error: '' }
    try {
      return { scenes: buildScenes(notationDocument, mapping), error: null }
    } catch (err) {
      return { scenes: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [notationDocument, mapping])

  const scenes = result.scenes
  const sceneError = result.error || null

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border px-4 py-3">
        <h1 className="text-xl font-semibold">hggp image renderer</h1>
        {mapping && <p className="text-sm text-muted-foreground">Mapping loaded.</p>}
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="35" minSize="20" maxSize="60" className="min-w-0">
          <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
            <ImportMapping onImport={setImportedMapping} />
            <NotationInput onParsed={setNotationDocument} />

            {assetsError && (
              <p role="alert" className="text-sm text-destructive">
                Could not load Minecraft assets: {assetsError}
              </p>
            )}

            {sceneError && (
              <p role="alert" className="text-sm text-destructive">
                {sceneError}
              </p>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="65" minSize="30" className="min-w-0">
          <div className="h-full overflow-y-auto p-4">
            {!scenes && !sceneError && (
              <p className="text-sm text-muted-foreground">
                Paste or import hggp build notation on the left to render it here.
              </p>
            )}

            {scenes && (
              <div className="flex flex-col gap-6">
                {scenes.map((scene) => (
                  <section key={scene.name} className="flex flex-col gap-2">
                    <h2 className="font-mono text-sm text-muted-foreground">/{scene.name}/</h2>
                    <Suspense
                      fallback={<p className="text-sm text-muted-foreground">Loading 3D viewer…</p>}
                    >
                      <SceneViewer blocks={scene.blocks} assets={assets} />
                    </Suspense>
                  </section>
                ))}
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default App
