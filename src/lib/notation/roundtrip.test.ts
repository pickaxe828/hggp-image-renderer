import { describe, expect, it } from "vitest";
import { parseDocument } from "./parser.ts";
import { serializeDocument } from "./serializer.ts";

/**
 * serializeDocument(parseDocument(x)) must reparse to an IR that
 * deep-equals parseDocument(x) -- not necessarily the same text (whitespace
 * / indentation may normalize).
 */
function expectRoundTrips(source: string): void {
  const original = parseDocument(source);
  const serialized = serializeDocument(original);
  const reparsed = parseDocument(serialized);
  expect(reparsed).toEqual(original);
}

describe("round trip: parseDocument -> serializeDocument -> parseDocument", () => {
  it("round-trips the reference example from CLAUDE.md", () => {
    expectRoundTrips(`
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
  });

  it("round-trips a document with multiple modules and multiple models (shadowing)", () => {
    expectRoundTrips(`
---
░░ ::= [$..]<8,8>;
▒▒ ::= [$##]<8,8>;
---

[[
  ░░▒▒
]]:=/A/;

---
░░ ::= [$#w]<8,8>;
---

[[
  ░░▒▒
]]:=/B/;
`);
  });

  it("round-trips a 1-D extent equivalence statement", () => {
    expectRoundTrips(`[@0]<3> == [[ [@0][@0][@0] ]];`);
  });

  it("round-trips a 2-D extent equivalence statement", () => {
    expectRoundTrips(`
[@0]<3,3> == [[
  [@0][@0][@0]
  [@0][@0][@0]
  [@0][@0][@0]
]];
`);
  });

  it("round-trips a 3-D extent equivalence statement (nested slices)", () => {
    expectRoundTrips(`
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
  });

  it("round-trips a model mixing bracketed words and glyph shorthand in the same row", () => {
    expectRoundTrips(`
---
.. ::= [$_]<8,8>;
---
[[
  ..[@0]..[!<$]
]]:=/mixed/;
`);
  });

  it("round-trips a document with no terminators at all", () => {
    expectRoundTrips(`[@0]<1> == [[ [@0] ]]`);
  });

  it("round-trips a document using ';;' terminators throughout", () => {
    expectRoundTrips(`
---
@@ ::= /@/;;
---
[[ @@ ]]:=/C/;;
`);
  });

  it("round-trips a document using 1-character glyphs", () => {
    expectRoundTrips(`
---
# ::= [$#w~];
@ ::= [|];
---
[[
  ####
  #@@#
  ####
]]:=/portal/;
`);
  });

  it("round-trips an element reference name containing a literal '/'", () => {
    expectRoundTrips(`[[ [@0] ]]:=/>/C//;`);
  });

  it("round-trips an identify statement with no `:=/name/;` suffix", () => {
    expectRoundTrips(`[[ [@0][@0] ]];`);
  });

  describe("direction spec", () => {
    function reexport(source: string): string {
      return serializeDocument(parseDocument(source));
    }

    it("re-emits a spec the model had, and round-trips it", () => {
      const source = `[[ [a][b] ]]</>v/>:=/C/;`;
      expectRoundTrips(source);
      expect(reexport(source)).toContain("]]</>v/>:=/C/;");
    });

    it("never adds a spec to a model that had none", () => {
      const source = `[[ [a][b] ]]:=/C/;`;
      expectRoundTrips(source);
      expect(reexport(source)).not.toMatch(/\]\]</);
    });

    it("keeps an explicit spec that equals the default", () => {
      // `>v` is the 2D default, `>v+` the 3D default -- both must stay.
      const flat = reexport(`[[ [a] ]]<(/>v/)>:=/C/;`);
      expect(flat).toContain("]]</>v/>:=/C/;");
      const stack = reexport(`[[\n [[ [a] ]]\n [[ [b] ]]\n]]<(/>v+/)>:=/C/;`);
      expect(stack).toContain("]]</>v+/>:=/C/;");
    });

    it("writes the short form: no parentheses, trailing _ dropped, inner _ kept", () => {
      expect(reexport(`[[ [a] ]]<(/>v+_/)>;`)).toContain("]]</>v+/>;");
      expect(reexport(`[[ [a] ]]<(/_v>/)>;`)).toContain("]]</_v>/>;");
      expect(reexport(`[[ [a] ]]<(/>v_+/)>;`)).toContain("]]</>v_+/>;");
    });

    it("round-trips an all-unused spec", () => {
      expectRoundTrips(`[[ [a] ]]<(//)>;`);
    });

    it("round-trips a spec on a 3D model, only on its outermost ]]", () => {
      const source = `[[\n [[ [a] ]]\n [[ [b] ]]\n]]<(/<^-/)>:=/C/;`;
      expectRoundTrips(source);
      expect(reexport(source).match(/<\//g)).toHaveLength(1);
    });

    it("round-trips a spec on the model on the right of ==", () => {
      const source = `[w]<2> == [[ [w][w] ]]</>v/>;`;
      expectRoundTrips(source);
      expect(reexport(source)).toContain("]]</>v/>;");
    });

    it("round-trips specs next to element references and module glyphs", () => {
      expectRoundTrips(`
---
@@ ::= /@/;
---
[[ @@ ]]</>v/>:=/C/;
[[ @@ ]]:=/D/;
`);
    });
  });

  it("round-trips a dangling forward element reference (valid, not an error)", () => {
    // /@/ is referenced by the module but never identified anywhere in the
    // document -- parsing must succeed regardless.
    expectRoundTrips(`
---
@@ ::= /@/;
---
[[ @@ ]]:=/C/;
`);
  });
});
