/**
 * Splits a glyph row into fixed 2-code-point cells.
 *
 * Glyphs are exactly two Unicode scalar values wide, but those scalar
 * values may themselves be multi-byte (e.g. "░", "▒", "█") or mixed with
 * ASCII (e.g. "~w"). Splitting must iterate code points -- never bytes or
 * UTF-16 code units -- or multi-byte glyphs desynchronize the pairing.
 */
export function tokenizeGlyphRow(row: string): string[] {
  const codePoints = Array.from(row);
  if (codePoints.length % 2 !== 0) {
    throw new Error(
      `Glyph row has an odd number of code points (${codePoints.length}): ${JSON.stringify(row)}`,
    );
  }
  const cells: string[] = [];
  for (let i = 0; i < codePoints.length; i += 2) {
    cells.push(codePoints[i] + codePoints[i + 1]);
  }
  return cells;
}
