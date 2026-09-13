import { describe, expect, it } from "vitest";
import {
  mergeModuleTable,
  resolveElement,
  resolveGlyph,
  UndefinedGlyphError,
} from "./modules.ts";
import { CycleError } from "./ir.ts";
import type { GlyphDefinition, ModelContent } from "./ir.ts";

const dotDef: GlyphDefinition = {
  kind: "definition",
  glyph: "..",
  rhs: { kind: "word", word: "$_", extent: [8, 8] },
};

const atAtDef: GlyphDefinition = {
  kind: "definition",
  glyph: "@@",
  rhs: { kind: "element", name: "@" },
};

describe("mergeModuleTable", () => {
  it("adds definitions from an empty base table", () => {
    const table = mergeModuleTable(new Map(), [dotDef]);
    expect(table.get("..")).toEqual(dotDef.rhs);
  });

  it("carries earlier definitions forward into later merges", () => {
    const first = mergeModuleTable(new Map(), [dotDef]);
    const second = mergeModuleTable(first, [atAtDef]);
    expect(second.get("..")).toEqual(dotDef.rhs);
    expect(second.get("@@")).toEqual(atAtDef.rhs);
  });

  it("shadows an earlier definition of the same glyph with a later one", () => {
    const first = mergeModuleTable(new Map(), [dotDef]);
    const redefine: GlyphDefinition = {
      kind: "definition",
      glyph: "..",
      rhs: { kind: "word", word: "$##", extent: [8, 8] },
    };
    const second = mergeModuleTable(first, [redefine]);
    expect(second.get("..")).toEqual(redefine.rhs);
  });
});

describe("resolveGlyph", () => {
  it("returns the bound rhs for a defined glyph", () => {
    const table = mergeModuleTable(new Map(), [dotDef]);
    expect(resolveGlyph(table, "..")).toEqual(dotDef.rhs);
  });

  it("throws UndefinedGlyphError for a glyph with no binding", () => {
    const table = mergeModuleTable(new Map(), [dotDef]);
    expect(() => resolveGlyph(table, "??")).toThrow(UndefinedGlyphError);
  });
});

describe("resolveElement", () => {
  it("returns undefined for a dangling forward reference (valid, not an error)", () => {
    const table = mergeModuleTable(new Map(), [atAtDef]);
    const lookup = () => undefined;
    expect(resolveElement(lookup, table, "@")).toBeUndefined();
  });

  it("chases a chain through two distinct elements without error", () => {
    // /A/'s model uses glyph @@ which resolves to element /B/; /B/'s model
    // has no further glyph references.
    const table = mergeModuleTable(new Map(), [atAtDef]);
    const bContent: ModelContent = {
      kind: "slice2d",
      rows: [[{ kind: "word", word: "$_" }]],
    };
    const aContent: ModelContent = {
      kind: "slice2d",
      rows: [[{ kind: "glyph", glyph: "@@" }]],
    };
    const models = new Map([
      ["@", bContent],
      ["A", aContent],
    ]);
    const lookup = (name: string) => models.get(name);
    expect(resolveElement(lookup, table, "A")).toEqual(aContent);
  });

  it("throws CycleError when an element's model refers back to itself through a glyph", () => {
    const table = mergeModuleTable(new Map(), [atAtDef]); // @@ ::= /@/
    const selfReferential: ModelContent = {
      kind: "slice2d",
      rows: [[{ kind: "glyph", glyph: "@@" }]],
    };
    const models = new Map([["@", selfReferential]]);
    const lookup = (name: string) => models.get(name);
    expect(() => resolveElement(lookup, table, "@")).toThrow(CycleError);
  });

  it("detects a longer cycle spanning a stack of slices", () => {
    // /A/ -> stack containing a slice with glyph @@ -> element /A/ (cycle)
    const aaDef: GlyphDefinition = {
      kind: "definition",
      glyph: "AA",
      rhs: { kind: "element", name: "A" },
    };
    const table = mergeModuleTable(new Map(), [aaDef]);
    const content: ModelContent = {
      kind: "stack3d",
      slices: [
        {
          kind: "slice2d",
          rows: [[{ kind: "glyph", glyph: "AA" }]],
        },
      ],
    };
    const models = new Map([["A", content]]);
    const lookup = (name: string) => models.get(name);
    expect(() => resolveElement(lookup, table, "A")).toThrow(CycleError);
  });
});
