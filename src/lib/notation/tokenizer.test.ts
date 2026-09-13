import { describe, expect, it } from "vitest";
import { tokenizeGlyphRow } from "./tokenizer.ts";

describe("tokenizeGlyphRow", () => {
  it("splits an ASCII glyph row into fixed 2-char cells", () => {
    expect(tokenizeGlyphRow("......@@....")).toEqual([
      "..",
      "..",
      "..",
      "@@",
      "..",
      "..",
    ]);
  });

  it("splits a row of multi-byte glyphs without desync", () => {
    // Each of ░░ ▒▒ ██ is a single Unicode scalar value repeated twice.
    expect(tokenizeGlyphRow("░░▒▒██")).toEqual(["░░", "▒▒", "██"]);
  });

  it("splits a mixed-width row (~w alongside 2-char glyphs) by code point pairs, not width", () => {
    // "~w~w░░" is 6 code points: ~ w ~ w ░ ░ -> pairs "~w" "~w" "░░"
    expect(tokenizeGlyphRow("~w~w░░")).toEqual(["~w", "~w", "░░"]);
  });

  it("throws on a row whose code-point length is not even", () => {
    expect(() => tokenizeGlyphRow("...")).toThrow();
  });
});
