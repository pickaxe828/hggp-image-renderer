import { describe, expect, it } from "vitest";
import { parseDocument } from "./parser.ts";
import { serializeDocument } from "./serializer.ts";
import type { Document } from "./ir.ts";

describe("serializeDocument", () => {
  it("serializes a module block back into ::= statements", () => {
    const doc: Document = {
      statements: [
        {
          kind: "module",
          definitions: [
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
          ],
        },
      ],
    };
    const text = serializeDocument(doc);
    expect(text).toContain("::=");
    expect(text).toContain("[$_]<8,8>");
    expect(text).toContain("/@/");
    // and it reparses to an equivalent IR
    expect(parseDocument(text)).toEqual(doc);
  });

  it("serializes an identify statement with mixed glyph/word cells", () => {
    const doc: Document = {
      statements: [
        {
          kind: "identify",
          elementName: "C",
          model: {
            kind: "slice2d",
            rows: [
              [
                { kind: "glyph", glyph: ".." },
                { kind: "word", word: "@0" },
              ],
            ],
          },
        },
      ],
    };
    const text = serializeDocument(doc);
    expect(parseDocument(text)).toEqual(doc);
  });

  it("serializes an equivalence statement with a 3-D extent as nested slices", () => {
    const doc: Document = {
      statements: [
        {
          kind: "equivalence",
          word: { kind: "word", word: "@0", extent: [2, 2, 2] },
          model: {
            kind: "stack3d",
            slices: [
              {
                kind: "slice2d",
                rows: [
                  [
                    { kind: "word", word: "@0" },
                    { kind: "word", word: "@0" },
                  ],
                  [
                    { kind: "word", word: "@0" },
                    { kind: "word", word: "@0" },
                  ],
                ],
              },
              {
                kind: "slice2d",
                rows: [
                  [
                    { kind: "word", word: "@0" },
                    { kind: "word", word: "@0" },
                  ],
                  [
                    { kind: "word", word: "@0" },
                    { kind: "word", word: "@0" },
                  ],
                ],
              },
            ],
          },
        },
      ],
    };
    const text = serializeDocument(doc);
    expect(parseDocument(text)).toEqual(doc);
  });
});
