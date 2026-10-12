import { describe, expect, it } from "vitest";
import { parseDocument } from "./parser.ts";
import type { DirectionSpec, ModelContent } from "./ir.ts";

function identifyModel(source: string): {
  model: ModelContent;
  elementName: string | undefined;
} {
  const stmt = parseDocument(source).statements[0];
  if (stmt.kind !== "identify") throw new Error("expected identify");
  return { model: stmt.model, elementName: stmt.elementName };
}

const xy: DirectionSpec = { x: ">", y: "v", z: "_", t: "_" };

describe("parseDocument: direction spec", () => {
  it("parses a parenthesised spec directly after the closing ]] and before :=", () => {
    const { model, elementName } = identifyModel(`[[ [a] ]]<(/>v/)>:=/C/;`);
    expect(model.direction).toEqual(xy);
    expect(elementName).toBe("C");
  });

  it("leaves direction absent when the model has no spec", () => {
    const { model } = identifyModel(`[[ [a] ]]:=/C/;`);
    expect(model.direction).toBeUndefined();
  });

  it("treats the parentheses as optional", () => {
    const withParens = identifyModel(`[[ [a] ]]<(/>v+/)>:=/C/;`).model;
    const without = identifyModel(`[[ [a] ]]</>v+/>:=/C/;`).model;
    expect(without.direction).toEqual({ x: ">", y: "v", z: "+", t: "_" });
    expect(without.direction).toEqual(withParens.direction);
  });

  it("treats trailing entries as unused, so a trailing _ is redundant", () => {
    const short = identifyModel(`[[ [a] ]]<(/>v+/)>;`).model.direction;
    const long = identifyModel(`[[ [a] ]]<(/>v+_/)>;`).model.direction;
    expect(short).toEqual({ x: ">", y: "v", z: "+", t: "_" });
    expect(long).toEqual(short);
  });

  it("accepts _ anywhere in the spec and all seven glyphs, assigned by world axis", () => {
    expect(identifyModel(`[[ [a] ]]<(/_v>/)>;`).model.direction).toEqual({
      x: "_",
      y: "v",
      z: ">",
      t: "_",
    });
    expect(identifyModel(`[[ [a] ]]<(/<^-+/)>;`).model.direction).toEqual({
      x: "<",
      y: "^",
      z: "-",
      t: "+",
    });
  });

  it("does not borrow missing entries from the default", () => {
    expect(identifyModel(`[[ [a] ]]<(/>/)>;`).model.direction).toEqual({
      x: ">",
      y: "_",
      z: "_",
      t: "_",
    });
  });

  it("parses an empty spec as every axis unused", () => {
    expect(identifyModel(`[[ [a] ]]<(//)>;`).model.direction).toEqual({
      x: "_",
      y: "_",
      z: "_",
      t: "_",
    });
  });

  it("puts a 3D model's spec on its outermost ]] only", () => {
    const { model } = identifyModel(
      `[[\n [[ [a] ]]\n [[ [b] ]]\n]]<(/>v+/)>:=/C/;`
    );
    expect(model.kind).toBe("stack3d");
    expect(model.direction).toEqual({ x: ">", y: "v", z: "+", t: "_" });
    if (model.kind !== "stack3d") throw new Error("unreachable");
    expect(model.slices.every((s) => s.direction === undefined)).toBe(true);
  });

  it("parses a spec on the model on the right of ==", () => {
    const stmt = parseDocument(`[w]<2,2> == [[ [w][w] [w][w] ]]<(/>v/)>;`)
      .statements[0];
    if (stmt.kind !== "equivalence") throw new Error("expected equivalence");
    expect(stmt.model.direction).toEqual(xy);
  });

  it("does not read the spec as an element reference, and still reads element references", () => {
    const doc = parseDocument(`
---
@@ ::= /@/;
---
[[ @@ ]]</>v/>:=/C/;
`);
    const [mod, stmt] = doc.statements;
    if (mod.kind !== "module" || stmt.kind !== "identify")
      throw new Error("unexpected statements");
    expect(mod.definitions[0].rhs).toEqual({ kind: "element", name: "@" });
    expect(stmt.model.direction).toEqual(xy);
    expect(stmt.elementName).toBe("C");
  });

  it("does not leak a spec onto the next model", () => {
    const doc = parseDocument(`[[ [a] ]]<(/>v/)>:=/A/; [[ [b] ]]:=/B/;`);
    const [a, b] = doc.statements;
    if (a.kind !== "identify" || b.kind !== "identify")
      throw new Error("unexpected statements");
    expect(a.model.direction).toEqual(xy);
    expect(b.model.direction).toBeUndefined();
  });

  it("rejects more than four entries", () => {
    expect(() => parseDocument(`[[ [a] ]]<(/>v+_>/)>;`)).toThrow(
      /direction spec/i
    );
  });

  it("rejects an unknown glyph", () => {
    expect(() => parseDocument(`[[ [a] ]]<(/>q/)>;`)).toThrow(
      /direction spec/i
    );
  });

  it("rejects unbalanced parentheses", () => {
    expect(() => parseDocument(`[[ [a] ]]<(/>v/>;`)).toThrow(/direction spec/i);
    expect(() => parseDocument(`[[ [a] ]]</>v/)>;`)).toThrow(/direction spec/i);
  });
});
