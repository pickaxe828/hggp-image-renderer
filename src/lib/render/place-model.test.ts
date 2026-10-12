import { describe, expect, it } from "vitest";
import { CycleError } from "@/lib/notation";
import type { ModelContent, ModelLookup, ModuleTable, Row, Slice2D, Stack3D } from "@/lib/notation";
import { placeModelInWorld } from "./place-model.ts";

function word(w: string): { kind: "word"; word: string } {
  return { kind: "word", word: w };
}

function glyph(g: string): { kind: "glyph"; text: string } {
  return { kind: "glyph", text: g };
}

function slice2d(rows: Row[]): Slice2D {
  return { kind: "slice2d", rows };
}

function stack3d(slices: ModelContent[]): Stack3D {
  return { kind: "stack3d", slices };
}

const noGlyphs: ModuleTable = new Map();
const noElements: ModelLookup = () => undefined;

describe("placeModelInWorld", () => {
  describe("a standalone 2D slice (XY plane)", () => {
    it("places an asymmetric grid with row 0 at the highest Y, columns ascending as X", () => {
      // 3 rows x 2 cols, every cell distinct so a transposition or a wrong
      // flip direction would be caught, not just an off-by-one.
      const model = slice2d([
        [word("top-left"), word("top-right")],
        [word("mid-left"), word("mid-right")],
        [word("bot-left"), word("bot-right")],
      ]);

      const placed = placeModelInWorld(model, noGlyphs, noElements);

      expect(placed).toEqual(
        expect.arrayContaining([
          { word: "top-left", pos: [0, 2, 0] },
          { word: "top-right", pos: [1, 2, 0] },
          { word: "mid-left", pos: [0, 1, 0] },
          { word: "mid-right", pos: [1, 1, 0] },
          { word: "bot-left", pos: [0, 0, 0] },
          { word: "bot-right", pos: [1, 0, 0] },
        ]),
      );
      expect(placed).toHaveLength(6);
    });

    it("resolves a glyph cell through the module table to a bare word", () => {
      const table: ModuleTable = new Map([["..", { kind: "word", word: "$air" }]]);
      const model = slice2d([[glyph("..")]]);

      expect(placeModelInWorld(model, table, noElements)).toEqual([{ word: "$air", pos: [0, 0, 0] }]);
    });

    it("expands an extent-sized cell into its tiled sub-region, offset correctly alongside a plain neighbor cell", () => {
      // A 2x2-extent word cell followed by a plain 1x1 word cell in the
      // same row -- deliberately non-uniform, so a cumulative-offset bug
      // (assuming every cell is the same width) would be caught.
      //
      // The whole row is 2 units tall (the extent's own height), so the
      // top-level -Y flip applies to it too: the extent's own first
      // (top) tiled row lands at the *higher* Y, and the 1-tall "$solo"
      // cell aligns with that same top edge, not the bottom.
      const table: ModuleTable = new Map([
        ["░░", { kind: "word", word: "$fill", extent: [2, 2] }],
      ]);
      const model = slice2d([[glyph("░░"), word("$solo")]]);

      const placed = placeModelInWorld(model, table, noElements);

      expect(placed).toEqual(
        expect.arrayContaining([
          { word: "$fill", pos: [0, 1, 0] },
          { word: "$fill", pos: [1, 1, 0] },
          { word: "$fill", pos: [0, 0, 0] },
          { word: "$fill", pos: [1, 0, 0] },
          // The extent cell is 2 wide, so the plain neighbor starts at
          // x=2, aligned to the row's top (y=1).
          { word: "$solo", pos: [2, 1, 0] },
        ]),
      );
      expect(placed).toHaveLength(5);
    });

    it("embeds a referenced element's content at the cell's position", () => {
      const doorContent = slice2d([[word("$door-top")], [word("$door-bottom")]]);
      const lookup: ModelLookup = (name) => (name === "door" ? doorContent : undefined);
      const table: ModuleTable = new Map([["@@", { kind: "element", name: "door" }]]);
      const model = slice2d([[glyph("@@"), word("$wall")]]);

      const placed = placeModelInWorld(model, table, lookup);

      // The door is 1 cell wide x 2 rows tall, so it (and the row it's
      // in) is 2 units tall overall. Its own top row is closer to the
      // grid's top and so gets the higher Y, same -Y flip as everything
      // else; the sibling "$wall" cell (1 tall) aligns with that top
      // edge, and starts at x=1 (after the door's width).
      expect(placed).toEqual(
        expect.arrayContaining([
          { word: "$door-top", pos: [0, 1, 0] },
          { word: "$door-bottom", pos: [0, 0, 0] },
          { word: "$wall", pos: [1, 1, 0] },
        ]),
      );
      expect(placed).toHaveLength(3);
    });

    it("throws a clear error for a cell whose glyph is unbound", () => {
      const model = slice2d([[glyph("??")]]);
      expect(() => placeModelInWorld(model, noGlyphs, noElements)).toThrow(/\?\?/);
    });

    it("degrades a cell referencing an element with no defining model to a placeholder, rather than failing the render", () => {
      // A dangling element reference is valid notation (see
      // lib/notation/modules.ts) -- CLAUDE.md's own reference example
      // relies on this (`@@ ::= /@/`, `/@/` never defined). The whole
      // render must still succeed; only this cell degrades.
      const table: ModuleTable = new Map([["@@", { kind: "element", name: "ghost" }]]);
      const model = slice2d([[glyph("@@"), word("$wall")]]);

      const placed = placeModelInWorld(model, table, noElements);

      expect(placed).toHaveLength(2);
      expect(placed).toContainEqual({ word: "$wall", pos: [1, 0, 0] });
      const placeholder = placed.find((b) => b.pos[0] === 0);
      expect(placeholder?.word).toContain("ghost");
    });

    it("throws CycleError for a cell whose element content cycles back to the top-level model's own name", () => {
      // model is `/a/`'s content; `/a/`'s content contains a cell for
      // `/b/`; `/b/`'s content contains a cell for `/a/` again.
      const modelA = slice2d([[glyph("@b")]]);
      const modelB = slice2d([[glyph("@a")]]);
      const lookup: ModelLookup = (name) => (name === "a" ? modelA : name === "b" ? modelB : undefined);
      const table: ModuleTable = new Map([
        ["@b", { kind: "element", name: "b" }],
        ["@a", { kind: "element", name: "a" }],
      ]);

      expect(() => placeModelInWorld(modelA, table, lookup, new Set(["a"]))).toThrow(CycleError);
    });
  });

  describe("a stack of XZ slices", () => {
    it("places an asymmetric stack with slice 0 at Y=0 (ascending -- opposite direction from the 2D-slice row case)", () => {
      const model = stack3d([
        slice2d([[word("bottom-front")], [word("bottom-back")]]),
        slice2d([[word("mid-front")], [word("mid-back")]]),
        slice2d([[word("top-front")], [word("top-back")]]),
      ]);

      const placed = placeModelInWorld(model, noGlyphs, noElements);

      expect(placed).toEqual(
        expect.arrayContaining([
          // within-slice rows are Z, ascending; slice index is Y, ascending.
          { word: "bottom-front", pos: [0, 0, 0] },
          { word: "bottom-back", pos: [0, 0, 1] },
          { word: "mid-front", pos: [0, 1, 0] },
          { word: "mid-back", pos: [0, 1, 1] },
          { word: "top-front", pos: [0, 2, 0] },
          { word: "top-back", pos: [0, 2, 1] },
        ]),
      );
      expect(placed).toHaveLength(6);
    });
  });
});
