import { describe, expect, it } from "vitest";
import { parseDocument } from "./parser.ts";

describe("parseDocument", () => {
  it("parses a module block into a ModuleBlock statement with distinct definition kinds", () => {
    const doc = parseDocument(`
---
.. ::= [$_]<8,8>;
@@ ::= /@/;
---
`);
    expect(doc.statements).toHaveLength(1);
    const mod = doc.statements[0];
    expect(mod.kind).toBe("module");
    if (mod.kind !== "module") throw new Error("unreachable");
    expect(mod.definitions).toEqual([
      {
        kind: "definition",
        glyph: "..",
        rhs: { kind: "word", word: "$_", extent: [8, 8] },
      },
      {
        kind: "definition",
        glyph: "@@",
        rhs: { kind: "element", name: "@" },
      },
    ]);
  });

  it("parses a 1-character glyph definition, directly touching '::='", () => {
    const doc = parseDocument(`
---
#::=[$#w~];
@::=[|];
---
`);
    const mod = doc.statements[0];
    if (mod.kind !== "module") throw new Error("unreachable");
    expect(mod.definitions).toEqual([
      { kind: "definition", glyph: "#", rhs: { kind: "word", word: "$#w~" } },
      { kind: "definition", glyph: "@", rhs: { kind: "word", word: "|" } },
    ]);
  });

  it("parses a 1-character glyph definition separated from '::=' by exactly one space", () => {
    const doc = parseDocument(`
---
# ::= [$#w~];
@ ::= [|];
---
`);
    const mod = doc.statements[0];
    if (mod.kind !== "module") throw new Error("unreachable");
    expect(mod.definitions).toEqual([
      { kind: "definition", glyph: "#", rhs: { kind: "word", word: "$#w~" } },
      { kind: "definition", glyph: "@", rhs: { kind: "word", word: "|" } },
    ]);
  });

  it("throws a clear error for a glyph definition that's neither 1 nor 2 characters", () => {
    expect(() => parseDocument(`--- \n### ::= [$_];\n---\n`)).toThrow(
      /1 or 2 characters/
    );
  });

  it("parses a 2D block model into an identify statement, accepting glyph and bracketed-word cells in the same model", () => {
    const doc = parseDocument(`
[[
  ..@@[@0]
]]:=/C/;
`);
    expect(doc.statements).toHaveLength(1);
    const stmt = doc.statements[0];
    expect(stmt.kind).toBe("identify");
    if (stmt.kind !== "identify") throw new Error("unreachable");
    expect(stmt.elementName).toBe("C");
    // "..@@" is one contiguous run before the bracketed word -- parsing
    // doesn't split it into individual glyphs (that needs the module
    // table, which parsing doesn't have; see resolveRowCells in
    // modules.ts). It's kept as one raw GlyphCell.
    expect(stmt.model).toEqual({
      kind: "slice2d",
      rows: [
        [
          { kind: "glyph", text: "..@@" },
          { kind: "word", word: "@0" },
        ],
      ],
    });
  });

  it("parses the full reference example: modules leak into the following model", () => {
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
    expect(doc.statements).toHaveLength(2);
    const [mod, model] = doc.statements;
    expect(mod.kind).toBe("module");
    expect(model.kind).toBe("identify");
    if (model.kind !== "identify") throw new Error("unreachable");
    expect(model.model.kind).toBe("slice2d");
    if (model.model.kind !== "slice2d") throw new Error("unreachable");
    expect(model.model.rows).toHaveLength(2);
    // Each row has no bracketed words at all, so it's one uninterrupted
    // run -- splitting into individual glyphs is deferred (see above).
    expect(model.model.rows[0]).toEqual([
      { kind: "glyph", text: "......@@...." },
    ]);
    expect(model.model.rows[1]).toEqual([
      { kind: "glyph", text: "████████████" },
    ]);
  });

  it("parses an equivalence statement with a 1-D extent", () => {
    const doc = parseDocument(`[@0]<3> == [[ [@0][@0][@0] ]];`);
    expect(doc.statements).toHaveLength(1);
    const stmt = doc.statements[0];
    expect(stmt.kind).toBe("equivalence");
    if (stmt.kind !== "equivalence") throw new Error("unreachable");
    expect(stmt.word).toEqual({ kind: "word", word: "@0", extent: [3] });
    expect(stmt.model).toEqual({
      kind: "slice2d",
      rows: [
        [
          { kind: "word", word: "@0" },
          { kind: "word", word: "@0" },
          { kind: "word", word: "@0" },
        ],
      ],
    });
  });

  it("parses an equivalence statement with a 2-D extent across multiple rows", () => {
    const doc = parseDocument(`
[@0]<3,3> == [[
  [@0][@0][@0]
  [@0][@0][@0]
  [@0][@0][@0]
]];
`);
    const stmt = doc.statements[0];
    if (stmt.kind !== "equivalence") throw new Error("unreachable");
    expect(stmt.word).toEqual({ kind: "word", word: "@0", extent: [3, 3] });
    if (stmt.model.kind !== "slice2d") throw new Error("unreachable");
    expect(stmt.model.rows).toHaveLength(3);
  });

  it("parses a 3-D extent equivalence as a stack of nested 2D slices", () => {
    const doc = parseDocument(`
[@0]<2,2,2> == [[
  [[
    [@0][@0]
    [@0][@0]
  ]]
  [[
    [@0][@0]
    [@0][@0]
  ]]
]];
`);
    const stmt = doc.statements[0];
    if (stmt.kind !== "equivalence") throw new Error("unreachable");
    expect(stmt.word.extent).toEqual([2, 2, 2]);
    expect(stmt.model.kind).toBe("stack3d");
    if (stmt.model.kind !== "stack3d") throw new Error("unreachable");
    expect(stmt.model.slices).toHaveLength(2);
    for (const slice of stmt.model.slices) {
      expect(slice.kind).toBe("slice2d");
      if (slice.kind !== "slice2d") throw new Error("unreachable");
      expect(slice.rows).toHaveLength(2);
      expect(slice.rows[0]).toHaveLength(2);
    }
  });

  it("accepts ';', ';;', and no terminator at end of input", () => {
    const withSemi = parseDocument(`[@0]<1> == [[ [@0] ]];`);
    const withDoubleSemi = parseDocument(`[@0]<1> == [[ [@0] ]];;`);
    const withNone = parseDocument(`[@0]<1> == [[ [@0] ]]`);
    expect(withSemi.statements).toHaveLength(1);
    expect(withDoubleSemi.statements).toHaveLength(1);
    expect(withNone.statements).toHaveLength(1);
  });

  it("shadows an earlier glyph definition with a later module's redefinition", () => {
    const doc = parseDocument(`
---
░░ ::= [$..]<8,8>;
---
[[ ░░ ]]:=/A/;
---
░░ ::= [$#w]<8,8>;
---
[[ ░░ ]]:=/B/;
`);
    expect(doc.statements).toHaveLength(4);
    const [firstMod, , secondMod] = doc.statements;
    if (firstMod.kind !== "module" || secondMod.kind !== "module") {
      throw new Error("unreachable");
    }
    expect(firstMod.definitions[0].rhs).toEqual({
      kind: "word",
      word: "$..",
      extent: [8, 8],
    });
    expect(secondMod.definitions[0].rhs).toEqual({
      kind: "word",
      word: "$#w",
      extent: [8, 8],
    });
  });

  it("accumulates a mixed-width glyph run (~w alongside a multi-byte glyph) without desync", () => {
    // Splitting into individual glyphs is deferred (see above) -- this
    // checks that accumulating the raw run itself doesn't corrupt a
    // multi-byte code point by iterating UTF-16 units instead of code
    // points.
    const doc = parseDocument(`[[ ~w~w░░ ]]:=/M/;`);
    const stmt = doc.statements[0];
    if (stmt.kind !== "identify") throw new Error("unreachable");
    if (stmt.model.kind !== "slice2d") throw new Error("unreachable");
    expect(stmt.model.rows[0]).toEqual([{ kind: "glyph", text: "~w~w░░" }]);
  });

  it("preserves a trailing space that is the second half of a space-containing glyph, when the row ends at a newline rather than the model's own ]]", () => {
    // Regression test: parseRow used to unconditionally .trim() every row,
    // which silently ate this trailing space even though it's the second,
    // meaningful character of the glyph "· " (dot+space, defined below as
    // dot followed by two spaces -- the first space is the glyph's own
    // second character, the second is ordinary whitespace before "::=").
    const doc = parseDocument(`
---
·  ::= [$_];
---

[[
  · 
]]:=/M/;
`);
    const [, model] = doc.statements;
    if (model.kind !== "identify") throw new Error("unreachable");
    if (model.model.kind !== "slice2d") throw new Error("unreachable");
    expect(model.model.rows[0]).toEqual([{ kind: "glyph", text: "· " }]);
  });

  it("still trims trailing whitespace when a row is cut short by the model's own ]] on the same line", () => {
    const doc = parseDocument(`[[ ░░ ]]:=/A/;`);
    const stmt = doc.statements[0];
    if (stmt.kind !== "identify") throw new Error("unreachable");
    if (stmt.model.kind !== "slice2d") throw new Error("unreachable");
    expect(stmt.model.rows[0]).toEqual([{ kind: "glyph", text: "░░" }]);
  });

  it("parses an element reference name containing a literal '/', delimited by the last '/' before the terminator", () => {
    const doc = parseDocument(`[[ [@0] ]]:=/>/C//;`);
    const stmt = doc.statements[0];
    if (stmt.kind !== "identify") throw new Error("unreachable");
    expect(stmt.elementName).toBe(">/C/");
  });

  it("parses a module rhs element reference name containing a literal '/'", () => {
    const doc = parseDocument(`
---
@@ ::= />/C//;
---
`);
    const mod = doc.statements[0];
    if (mod.kind !== "module") throw new Error("unreachable");
    expect(mod.definitions[0].rhs).toEqual({ kind: "element", name: ">/C/" });
  });

  it("parses an identify statement with no `:=/name/;` suffix -- the name is optional", () => {
    const doc = parseDocument(`[[ [$_] ]];`);
    const stmt = doc.statements[0];
    expect(stmt.kind).toBe("identify");
    if (stmt.kind !== "identify") throw new Error("unreachable");
    expect(stmt.elementName).toBeUndefined();
  });

  it("throws a clear error on an unterminated module block", () => {
    expect(() => parseDocument(`--- \n@@ ::= /@/;\n`)).toThrow(/---/);
  });

  it("throws a clear error on an unterminated model", () => {
    expect(() => parseDocument(`[[\n  @@@@\n`)).toThrow(/\]\]/);
  });

  it("throws a clear error on an unterminated bracketed word", () => {
    expect(() => parseDocument(`---\n@@ ::= [$_ ;\n---\n`)).toThrow();
  });
});
