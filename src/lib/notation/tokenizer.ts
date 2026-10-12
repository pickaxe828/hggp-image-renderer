import { UndefinedGlyphError } from "./ir.ts";
import type { Glyph } from "./ir.ts";

/**
 * Splits a raw glyph run into individual glyphs by longest match against
 * `definedGlyphs`.
 *
 * A glyph is 1 or 2 Unicode scalar values wide, and that width is a
 * property of each individual glyph binding, not fixed document-wide (a
 * module can bind "#" alongside ".." in the same table) -- so a run can't
 * be split by blindly pairing code points; it must be matched against
 * what's actually bound. At each position, the 2-code-point reading wins
 * if it's a bound glyph (maximal munch, same disambiguation rule as
 * multi-character operators in a typical lexer); otherwise the
 * 1-code-point reading is tried. If neither is bound, the run contains a
 * glyph nothing in scope defines.
 *
 * Scalar values may themselves be multi-byte (e.g. "░", "▒", "█") or mixed
 * with ASCII (e.g. "~w"). Splitting must iterate code points -- never
 * bytes or UTF-16 code units -- or multi-byte glyphs desynchronize.
 */
export function tokenizeGlyphRow(
  row: string,
  definedGlyphs: ReadonlySet<Glyph>
): string[] {
  const codePoints = Array.from(row);
  const cells: string[] = [];
  let i = 0;
  while (i < codePoints.length) {
    const two =
      i + 1 < codePoints.length ? codePoints[i] + codePoints[i + 1] : undefined;
    if (two !== undefined && definedGlyphs.has(two)) {
      cells.push(two);
      i += 2;
      continue;
    }
    const one = codePoints[i];
    if (definedGlyphs.has(one)) {
      cells.push(one);
      i += 1;
      continue;
    }
    // Neither reading at this position is bound -- report the wider one
    // (the two-code-point reading, when there were enough code points left
    // to attempt it) since that's the more likely intended glyph.
    throw new UndefinedGlyphError(two ?? one);
  }
  return cells;
}
