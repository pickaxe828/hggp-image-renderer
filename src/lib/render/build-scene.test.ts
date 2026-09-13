import { describe, expect, it } from "vitest";
import { parseDocument } from "@/lib/notation";
import type { Mapping } from "@/lib/mapping/types";
import { UNRESOLVED_BLOCK } from "@/lib/mapping/resolve";
import { buildScene, NoRenderableModelError } from "./build-scene.ts";

const mapping: Mapping = {
  version: 1,
  words: {
    $_: "minecraft:stone",
    "!<$": "minecraft:dirt",
  },
};

describe("buildScene", () => {
  it("renders the CLAUDE.md reference example end to end, resolving blocks per cell", () => {
    const doc = parseDocument(`
---
.. ::= [$_]<8,8>;
██ ::= [!<$]<8,8>;
@@ ::= /@/;
---

[[
  ......@@....
  ████████████
]]:=/C/;
`);

    const placed = buildScene(doc, mapping);

    // Row 0 of text ("......@@....") is 6 cells: 5 "." cells (each an
    // 8x8 tile of $_) and one "@@" cell -- a dangling forward reference
    // to /@/ (never `:=`-defined anywhere, exactly as CLAUDE.md's prose
    // describes), which degrades to a single 1x1 placeholder rather than
    // failing the whole render. Row 1 ("████████████") is 6 uniform "██"
    // cells (8x8 of !<$ each). 5*64 + 1 + 6*64 = 705.
    expect(placed).toHaveLength(5 * 64 + 1 + 6 * 64);
    // Row 0 of text is the *top* -- world Y 8..15 for its resolved
    // (8-tall) cells.
    expect(placed).toContainEqual({ blockId: "minecraft:stone", pos: [0, 15, 0] });
    // Row 1 of text is the bottom -- world Y 0..7.
    expect(placed).toContainEqual({ blockId: "minecraft:dirt", pos: [0, 0, 0] });
    // Exactly the dangling /@/ cell is left unresolved.
    expect(placed.filter((b) => b.blockId === UNRESOLVED_BLOCK)).toHaveLength(1);
  });

  it("resolves an unmapped word to the placeholder sentinel instead of throwing", () => {
    const doc = parseDocument(`[[ [$unknown-word] ]]:=/X/;`);
    const placed = buildScene(doc, mapping);
    expect(placed).toEqual([{ blockId: UNRESOLVED_BLOCK, pos: [0, 0, 0] }]);
  });

  it("resolves every block to the placeholder sentinel when no mapping is loaded", () => {
    const doc = parseDocument(`[[ [$_] ]]:=/X/;`);
    expect(buildScene(doc, null)).toEqual([{ blockId: UNRESOLVED_BLOCK, pos: [0, 0, 0] }]);
    expect(buildScene(doc, undefined)).toEqual([{ blockId: UNRESOLVED_BLOCK, pos: [0, 0, 0] }]);
  });

  it("renders the last `:=` identify statement in the document as the build, per the documented default", () => {
    const doc = parseDocument(`
[[ [$_] ]]:=/first/;

[[ [!<$][!<$] ]]:=/second/;
`);
    const placed = buildScene(doc, mapping);
    expect(placed).toEqual(
      expect.arrayContaining([
        { blockId: "minecraft:dirt", pos: [0, 0, 0] },
        { blockId: "minecraft:dirt", pos: [1, 0, 0] },
      ]),
    );
    expect(placed).toHaveLength(2);
  });

  it("throws NoRenderableModelError when the document defines no identify statement", () => {
    const doc = parseDocument(`[@0]<3> == [[ [@0][@0][@0] ]];`);
    expect(() => buildScene(doc, mapping)).toThrow(NoRenderableModelError);
  });
});
