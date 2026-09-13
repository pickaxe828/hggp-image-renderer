/**
 * Row/slice index -> world-Y mapping.
 *
 * Per CLAUDE.md's "Row order vs Y -- WORKING ASSUMPTION" (not confirmed
 * against the hggp spec -- this is a provisional decision by the project
 * owner, flippable in this one function once the real rule is confirmed):
 *
 * - A slice that *contains* Y (rendered here as a standalone 2D model --
 *   see build-scene.ts's scope note on the XY/YZ open question) has its
 *   text rows run -Y: row 0 is the top of the build (the highest Y), the
 *   last row is Y=0.
 * - A stack of XZ slices (no Y inside each slice; the third axis expressed
 *   by nesting `[[ ]]`) advances +Y per slice: slice 0 is Y=0, later
 *   slices are higher.
 *
 * These pull in opposite directions and are intentionally NOT unified into
 * one flip -- see the two branches below.
 */
export type WorldYContext =
  | {
      readonly kind: "row-in-2d-slice";
      /** Total row count of the slice this row index belongs to. */
      readonly rowCount: number;
    }
  | {
      readonly kind: "slice-in-stack";
    };

export function resolveWorldY(index: number, context: WorldYContext): number {
  if (context.kind === "row-in-2d-slice") {
    return context.rowCount - 1 - index;
  }
  return index;
}
