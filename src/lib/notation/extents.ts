import type {
  Cell,
  Extent,
  ModelContent,
  Row,
  Slice2D,
  WordRef,
} from "./ir.ts";

/**
 * Expands a word tiled by an extent into the corresponding cell grid.
 *
 * Axis order is [X, Y, Z], each ascending:
 * - <X>       -> a single row of X cells (a 1-row slice)
 * - <X,Y>     -> a Y-row, X-wide slice
 * - <X,Y,Z>   -> a stack of Z such slices (the third axis expressed by
 *                nesting slices, per the grammar)
 *
 * The word's own extent (if any) is stripped from the tiled cell -- the
 * extent describes the *region*, not a per-cell size.
 */
export function expandExtent(word: WordRef, extent: Extent): ModelContent {
  if (extent.length < 1 || extent.length > 3) {
    throw new Error(
      `Extent must have 1, 2, or 3 axes, got ${extent.length}: <${extent.join(",")}>`
    );
  }

  const cell: Cell = { kind: "word", word: word.word };

  const [x, y = 1, z] = extent;

  const makeSlice = (): Slice2D => {
    const rows: Row[] = [];
    for (let ry = 0; ry < y; ry++) {
      const row: Row = [];
      for (let rx = 0; rx < x; rx++) {
        row.push(cell);
      }
      rows.push(row);
    }
    return { kind: "slice2d", rows };
  };

  if (z === undefined) {
    return makeSlice();
  }

  const slices: ModelContent[] = [];
  for (let rz = 0; rz < z; rz++) {
    slices.push(makeSlice());
  }
  return { kind: "stack3d", slices };
}
