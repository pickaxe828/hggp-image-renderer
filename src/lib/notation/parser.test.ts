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
    expect(stmt.model).toEqual({
      kind: "slice2d",
      rows: [
        [
          { kind: "glyph", glyph: ".." },
          { kind: "glyph", glyph: "@@" },
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
    expect(model.model.rows[0]).toEqual([
      { kind: "glyph", glyph: ".." },
      { kind: "glyph", glyph: ".." },
      { kind: "glyph", glyph: ".." },
      { kind: "glyph", glyph: "@@" },
      { kind: "glyph", glyph: ".." },
      { kind: "glyph", glyph: ".." },
    ]);
    expect(model.model.rows[1]).toEqual([
      { kind: "glyph", glyph: "██" },
      { kind: "glyph", glyph: "██" },
      { kind: "glyph", glyph: "██" },
      { kind: "glyph", glyph: "██" },
      { kind: "glyph", glyph: "██" },
      { kind: "glyph", glyph: "██" },
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

  it("parses a mixed-width glyph row (~w alongside 2-char glyphs) without desync", () => {
    const doc = parseDocument(`[[ ~w~w░░ ]]:=/M/;`);
    const stmt = doc.statements[0];
    if (stmt.kind !== "identify") throw new Error("unreachable");
    if (stmt.model.kind !== "slice2d") throw new Error("unreachable");
    expect(stmt.model.rows[0]).toEqual([
      { kind: "glyph", glyph: "~w" },
      { kind: "glyph", glyph: "~w" },
      { kind: "glyph", glyph: "░░" },
    ]);
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
