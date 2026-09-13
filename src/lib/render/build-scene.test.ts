import { describe, expect, it } from "vitest";
import { parseDocument } from "@/lib/notation";
import type { Mapping } from "@/lib/mapping/types";
import { UNRESOLVED_BLOCK } from "@/lib/mapping/resolve";
import { buildScenes, NoRenderableModelError } from "./build-scene.ts";

const mapping: Mapping = {
  version: 1,
  words: {
    $_: "minecraft:stone",
    "!<$": "minecraft:dirt",
  },
};

describe("buildScenes", () => {
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

    const scenes = buildScenes(doc, mapping);
    expect(scenes).toHaveLength(1);
    const [{ name, blocks: placed }] = scenes;
    expect(name).toBe("C");

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
    const scenes = buildScenes(doc, mapping);
    expect(scenes).toEqual([{ name: "X", blocks: [{ blockId: UNRESOLVED_BLOCK, pos: [0, 0, 0] }] }]);
  });

  it("resolves every block to the placeholder sentinel when no mapping is loaded", () => {
    const doc = parseDocument(`[[ [$_] ]]:=/X/;`);
    expect(buildScenes(doc, null)).toEqual([{ name: "X", blocks: [{ blockId: UNRESOLVED_BLOCK, pos: [0, 0, 0] }] }]);
    expect(buildScenes(doc, undefined)).toEqual([
      { name: "X", blocks: [{ blockId: UNRESOLVED_BLOCK, pos: [0, 0, 0] }] },
    ]);
  });

  it("renders every top-level `:=` identify statement as its own scene, in document order", () => {
    const doc = parseDocument(`
[[ [$_] ]]:=/first/;

[[ [!<$][!<$] ]]:=/second/;
`);
    const scenes = buildScenes(doc, mapping);
    expect(scenes.map((s) => s.name)).toEqual(["first", "second"]);
    expect(scenes[0].blocks).toEqual([{ blockId: "minecraft:stone", pos: [0, 0, 0] }]);
    expect(scenes[1].blocks).toEqual([
      { blockId: "minecraft:dirt", pos: [0, 0, 0] },
      { blockId: "minecraft:dirt", pos: [1, 0, 0] },
    ]);
  });

  it("excludes an identify statement from the scene list when it's referenced by glyph elsewhere, rendering it only as embedded content", () => {
    const doc = parseDocument(`
[[ [$_] ]]:=/part/;

---
%% ::= /part/;
---

[[ %%%% ]]:=/assembly/;
`);
    const scenes = buildScenes(doc, mapping);
    // /part/ is consumed via the %% glyph inside /assembly/, so it's a
    // sub-component, not a scene of its own -- only /assembly/ renders.
    expect(scenes.map((s) => s.name)).toEqual(["assembly"]);
    expect(scenes[0].blocks).toEqual([
      { blockId: "minecraft:stone", pos: [0, 0, 0] },
      { blockId: "minecraft:stone", pos: [1, 0, 0] },
    ]);
  });

  it("resolves each scene's glyphs against the module table as it stood at that scene's own position, not the document's final table", () => {
    // Regression test: ░░ is rebound between /first/ and /second/, exactly
    // as CLAUDE.md's own module doc describes ("░░ goes from [$..] to
    // [$#w] in the reference example"). Each scene must keep reading ░░
    // the way it was bound when *it* was written, not however a later
    // module redefines it.
    const doc = parseDocument(`
---
░░ ::= [$_];
---

[[ ░░ ]]:=/first/;

---
░░ ::= [!<$];
---

[[ ░░ ]]:=/second/;
`);
    const scenes = buildScenes(doc, mapping);
    expect(scenes.map((s) => s.name)).toEqual(["first", "second"]);
    expect(scenes[0].blocks).toEqual([{ blockId: "minecraft:stone", pos: [0, 0, 0] }]);
    expect(scenes[1].blocks).toEqual([{ blockId: "minecraft:dirt", pos: [0, 0, 0] }]);
  });

  it("throws NoRenderableModelError when the document defines no identify statement", () => {
    const doc = parseDocument(`[@0]<3> == [[ [@0][@0][@0] ]];`);
    expect(() => buildScenes(doc, mapping)).toThrow(NoRenderableModelError);
  });
});
