import { describe, expect, it } from "vitest";
import { tokenizeGlyphRow } from "./tokenizer.ts";
import { UndefinedGlyphError } from "./ir.ts";

describe("tokenizeGlyphRow", () => {
  it("splits an ASCII glyph row into its defined 2-char glyphs", () => {
    expect(tokenizeGlyphRow("......@@....", new Set(["..", "@@"]))).toEqual([
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
    expect(tokenizeGlyphRow("░░▒▒██", new Set(["░░", "▒▒", "██"]))).toEqual([
      "░░",
      "▒▒",
      "██",
    ]);
  });

  it("splits a mixed-width row (~w alongside 2-char glyphs) by code point pairs, not width", () => {
    expect(tokenizeGlyphRow("~w~w░░", new Set(["~w", "░░"]))).toEqual([
      "~w",
      "~w",
      "░░",
    ]);
  });

  it("splits a run of 1-character glyphs, not paired into 2s", () => {
    // "#@@#" with only "#" and "@" bound (both 1 char) -- must not be
    // mis-paired into "#@" "@#".
    expect(tokenizeGlyphRow("#@@#", new Set(["#", "@"]))).toEqual([
      "#",
      "@",
      "@",
      "#",
    ]);
  });

  it("prefers the 2-char reading over the 1-char reading at the same position (maximal munch)", () => {
    // Both "#" and "##" are bound; "###" should read as one 2-char glyph
    // then one 1-char glyph, not three 1-char glyphs.
    expect(tokenizeGlyphRow("###", new Set(["#", "##"]))).toEqual(["##", "#"]);
  });

  it("mixes 1-char and 2-char glyphs freely in the same run", () => {
    // "#" is 1 char, "~w" is 2 -- correctly told apart because "~w" is
    // bound and "#~" (the wrong pairing) is not.
    expect(tokenizeGlyphRow("#~w#", new Set(["#", "~w"]))).toEqual([
      "#",
      "~w",
      "#",
    ]);
  });

  it("throws UndefinedGlyphError for a glyph nothing in scope defines", () => {
    expect(() => tokenizeGlyphRow("??", new Set([".."]))).toThrow(
      UndefinedGlyphError
    );
    expect(() => tokenizeGlyphRow("??", new Set([".."]))).toThrow(/\?\?/);
  });

  it("throws UndefinedGlyphError naming the trailing 1-char glyph when only it is unmatched", () => {
    // "#" is bound, trailing "?" is not (and there's no code point after
    // it to try a 2-char reading with).
    expect(() => tokenizeGlyphRow("#?", new Set(["#"]))).toThrow(/"\?"/);
  });
});
