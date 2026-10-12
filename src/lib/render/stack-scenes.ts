import type { PlacedBlock, PlacedScene } from "./types.ts";

/** Vertical gap (in blocks of clear air) left between consecutive stacked
 * scenes -- enough to read as a visual break between separate builds, not
 * just render adjacency. */
export const SCENE_STACK_GAP = 16;

/**
 * Merges multiple scenes' resolved blocks into a single block list for one
 * shared 3D canvas: stacks them vertically in document order (first scene
 * highest) with `gap` blocks of clear air between each consecutive pair.
 *
 * Each scene's own X/Z footprint is left untouched -- only Y is shifted, and
 * shifted per scene so it renormalizes to sit directly beneath whatever
 * came before it, regardless of that scene's original Y range. The result
 * is separate builds floating at different heights in one shared view, not
 * merged into a single structure. Skips scenes with no blocks (nothing to
 * place, and nothing to leave a gap for).
 */
export function stackScenesVertically(
  scenes: readonly PlacedScene[],
  gap = SCENE_STACK_GAP
): PlacedBlock[] {
  const combined: PlacedBlock[] = [];
  let nextTopY = 0;

  for (const scene of scenes) {
    if (scene.blocks.length === 0) continue;

    const ys = scene.blocks.map((block) => block.pos[1]);
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    const yOffset = nextTopY - maxY;

    for (const block of scene.blocks) {
      combined.push({
        blockId: block.blockId,
        pos: [block.pos[0], block.pos[1] + yOffset, block.pos[2]],
      });
    }

    nextTopY -= maxY - minY + 1 + gap;
  }

  return combined;
}
