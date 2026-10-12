import { describe, expect, it } from "vitest";
import type { PlacedScene } from "./types.ts";
import { SCENE_STACK_GAP, stackScenesVertically } from "./stack-scenes.ts";

function scene(name: string, ys: number[]): PlacedScene {
  return {
    name,
    blocks: ys.map((y) => ({ blockId: `block-${y}`, pos: [0, y, 0] as const })),
  };
}

describe("stackScenesVertically", () => {
  it("returns an empty list for no scenes", () => {
    expect(stackScenesVertically([])).toEqual([]);
  });

  it("passes a single scene through, renormalized to sit at the top", () => {
    const result = stackScenesVertically([scene("only", [0, 1, 2])]);
    const positions = result.map((b) => b.pos);
    expect(Math.max(...positions.map((p) => p[1]))).toBe(0);
    // Relative spacing within the scene is preserved.
    expect(positions.map((p) => p[1]).sort((a, b) => a - b)).toEqual([
      -2, -1, 0,
    ]);
  });

  it("stacks two scenes with exactly the configured gap of clear air between them", () => {
    const result = stackScenesVertically([
      scene("top", [0, 1, 2]),
      scene("bottom", [0, 1]),
    ]);

    const ysByScene = {
      top: result.slice(0, 3).map((b) => b.pos[1]),
      bottom: result.slice(3).map((b) => b.pos[1]),
    };

    const topBottomEdge = Math.min(...ysByScene.top);
    const bottomTopEdge = Math.max(...ysByScene.bottom);

    // Air blocks strictly between the two scenes.
    expect(topBottomEdge - bottomTopEdge - 1).toBe(SCENE_STACK_GAP);
    // First scene renders highest (document order == top-to-bottom).
    expect(Math.min(...ysByScene.top)).toBeGreaterThan(
      Math.max(...ysByScene.bottom)
    );
  });

  it("preserves each scene's own X/Z footprint, shifting only Y", () => {
    const scenes: PlacedScene[] = [
      { name: "a", blocks: [{ blockId: "x", pos: [3, 0, -2] }] },
      { name: "b", blocks: [{ blockId: "y", pos: [-5, 0, 7] }] },
    ];
    const result = stackScenesVertically(scenes);
    expect(result.map((b) => [b.pos[0], b.pos[2]])).toEqual([
      [3, -2],
      [-5, 7],
    ]);
  });

  it("skips scenes with no blocks and doesn't reserve a gap for them", () => {
    const result = stackScenesVertically([
      scene("a", [0]),
      { name: "empty", blocks: [] },
      scene("b", [0]),
    ]);
    const [first, second] = result;
    expect(first.pos[1] - second.pos[1] - 1).toBe(SCENE_STACK_GAP);
  });

  it("accepts a custom gap", () => {
    const result = stackScenesVertically([scene("a", [0]), scene("b", [0])], 3);
    const [first, second] = result;
    expect(first.pos[1] - second.pos[1] - 1).toBe(3);
  });
});
