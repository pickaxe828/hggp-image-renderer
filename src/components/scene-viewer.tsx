import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { configure, createScene } from 'block-model-renderer'
import type { SceneHandle } from 'block-model-renderer'
import { UNRESOLVED_BLOCK } from '@/lib/mapping/resolve'
import type { PlacedBlock } from '@/lib/render/types'

// Provide our own three.js instance up front, per block-model-renderer's
// "Providing three.js (browser)" doc -- must happen before its first
// render call. A module-level call is fine: this module is only ever
// imported once per page.
configure({ THREE })

// A vanilla block with a distinctive built-in "blocked/invalid" icon,
// standing in for a word that didn't resolve to a real block. The
// renderer documents no fallback of its own for an unrecognized id, so
// the substitution happens here. `technical: true` below is required for
// it to actually draw that icon -- barrier is normally invisible in-game.
const PLACEHOLDER_BLOCK_ID = 'barrier'

export interface SceneViewerProps {
  blocks: PlacedBlock[]
  /** The client-jar bytes from `loadMojangAssets`, or `null` while still loading. */
  assets: ArrayBuffer | null
}

/**
 * The interactive 3D voxel view: renders `blocks` via block-model-renderer
 * and wires up three.js's OrbitControls for drag-orbit, scroll/pinch-zoom,
 * and pan.
 */
export function SceneViewer({ blocks, assets }: SceneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assets) return
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let sceneHandle: SceneHandle | null = null

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    // Cap the pixel ratio: an uncapped devicePixelRatio on a high-DPI
    // phone (the Galaxy A35 5G reference device is ~2.75x) multiplies
    // fragment-shader cost for no visible benefit past ~2x.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)

    const controls = new OrbitControls(camera, renderer.domElement)
    // No damping: render-on-demand (below) instead of a continuous
    // requestAnimationFrame loop, so an idle view costs nothing on
    // battery/thermals -- important for the mobile-perf requirement.
    controls.enableDamping = false

    const renderOnce = () => renderer.render(scene, camera)
    controls.addEventListener('change', renderOnce)

    function resize() {
      const { clientWidth: width, clientHeight: height } = container as HTMLDivElement
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderOnce()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const sceneBlocks = blocks.map((block) => ({
      id: block.blockId === UNRESOLVED_BLOCK ? PLACEHOLDER_BLOCK_ID : block.blockId,
      pos: block.pos as [number, number, number],
    }))

    createScene(assets, sceneBlocks, { technical: true })
      .then((handle) => {
        if (disposed) {
          handle?.dispose()
          return
        }
        if (!handle) return
        setError(null)
        sceneHandle = handle
        scene.add(handle.group)

        // Frame the whole build regardless of its size: aim the controls'
        // orbit target at its center and back the camera off by a
        // multiple of its bounding-sphere radius.
        const center = handle.bounds.getCenter(new THREE.Vector3())
        const sphere = handle.bounds.getBoundingSphere(new THREE.Sphere())
        const distance = Math.max(sphere.radius * 2.5, 1)
        camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.75, distance))
        camera.near = Math.max(distance / 100, 0.1)
        camera.far = distance * 20
        camera.updateProjectionMatrix()
        controls.target.copy(center)
        controls.update()
        renderOnce()
      })
      .catch((err: unknown) => {
        if (disposed) return
        setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      disposed = true
      resizeObserver.disconnect()
      controls.removeEventListener('change', renderOnce)
      controls.dispose()
      sceneHandle?.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [blocks, assets])

  if (!assets) {
    return <p className="text-sm text-muted-foreground">Loading Minecraft assets…</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-[60vh] min-h-80 w-full touch-none rounded-lg border border-input"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
