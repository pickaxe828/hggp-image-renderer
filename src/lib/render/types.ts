// Shared contract between the notation->scene pipeline (build-scene.ts,
// place-model.ts) and the 3D viewer (components/scene-viewer.tsx), so both
// sides can be built independently against a fixed shape.

/** One word placed at an integer grid position, before block-mapping
 * resolution. 1 unit = 1 block; axes are world X/Y/Z, ascending. */
export interface PlacedWord {
  readonly word: string;
  readonly pos: readonly [number, number, number];
}

/** One resolved Minecraft block placed at an integer grid position -- the
 * output of the notation->scene pipeline and the input to the viewer.
 * `blockId` is either a real block id (from `resolveBlock`) or the
 * `UNRESOLVED_BLOCK` sentinel from `lib/mapping/resolve`; the viewer is
 * responsible for substituting a visible placeholder for the sentinel, not
 * this layer. */
export interface PlacedBlock {
  readonly blockId: string;
  readonly pos: readonly [number, number, number];
}
