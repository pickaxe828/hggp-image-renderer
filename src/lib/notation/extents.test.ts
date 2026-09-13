import { describe, expect, it } from "vitest";
import { expandExtent } from "./extents.ts";
import type { WordRef } from "./ir.ts";

const word0: WordRef = { kind: "word", word: "@0" };

describe("expandExtent", () => {
  it("expands a 1-D extent <3> into a single row of 3 words", () => {
    const result = expandExtent(word0, [3]);
    expect(result).toEqual({
      kind: "slice2d",
      rows: [[word0, word0, word0]],
    });
  });

  it("expands a 2-D extent <3,3> into a 3x3 slice (3 rows of 3)", () => {
    const result = expandExtent(word0, [3, 3]);
    expect(result.kind).toBe("slice2d");
    if (result.kind !== "slice2d") throw new Error("unreachable");
    expect(result.rows).toHaveLength(3);
    for (const row of result.rows) {
      expect(row).toEqual([word0, word0, word0]);
    }
  });

  it("expands a 3-D extent <3,3,3> into a stack of 3 3x3 slices", () => {
    const result = expandExtent(word0, [3, 3, 3]);
    expect(result.kind).toBe("stack3d");
    if (result.kind !== "stack3d") throw new Error("unreachable");
    expect(result.slices).toHaveLength(3);
    for (const slice of result.slices) {
      expect(slice.kind).toBe("slice2d");
      if (slice.kind !== "slice2d") throw new Error("unreachable");
      expect(slice.rows).toHaveLength(3);
      for (const row of slice.rows) {
        expect(row).toEqual([word0, word0, word0]);
      }
    }
  });

  it("supports arbitrary, non-square sizes", () => {
    const result = expandExtent(word0, [4, 2]);
    expect(result.kind).toBe("slice2d");
    if (result.kind !== "slice2d") throw new Error("unreachable");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toHaveLength(4);
  });

  it("rejects an extent with zero axes", () => {
    expect(() => expandExtent(word0, [])).toThrow();
  });

  it("rejects an extent with more than 3 axes", () => {
    expect(() => expandExtent(word0, [2, 2, 2, 2])).toThrow();
  });
});
