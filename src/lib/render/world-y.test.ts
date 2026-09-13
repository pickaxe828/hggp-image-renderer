import { describe, expect, it } from "vitest";
import { resolveWorldY } from "./world-y.ts";

/**
 * Locks in the documented working assumption from CLAUDE.md ("Row order vs
 * Y -- WORKING ASSUMPTION"), using asymmetric fixtures per axis case so an
 * accidental reversal (or an off-by-one) can't pass by coincidence the way
 * a symmetric/palindromic size could.
 */
describe("resolveWorldY", () => {
  describe("row-in-2d-slice (a slice that contains Y: XY or YZ plane)", () => {
    it("maps text row 0 to the highest Y", () => {
      // 5 rows -- asymmetric (not a size that reads the same forwards and
      // backwards): row 0 is the top of the build, so it must land at the
      // *highest* Y, not Y=0.
      expect(resolveWorldY(0, { kind: "row-in-2d-slice", rowCount: 5 })).toBe(4);
    });

    it("maps the last text row to Y=0", () => {
      expect(resolveWorldY(4, { kind: "row-in-2d-slice", rowCount: 5 })).toBe(0);
    });

    it("maps interior rows in strictly descending Y order", () => {
      const rowCount = 5;
      const ys = [0, 1, 2, 3, 4].map((row) => resolveWorldY(row, { kind: "row-in-2d-slice", rowCount }));
      expect(ys).toEqual([4, 3, 2, 1, 0]);
    });

    it("is not a same-direction (ascending) mapping -- would be caught by a symmetric fixture only by accident", () => {
      // A 4-row fixture: if this were wrongly implemented as ascending
      // (row index === Y), row 1 would equal 1 instead of the correct 2.
      // A symmetric/odd-centered size could hide this kind of bug; this
      // doesn't.
      expect(resolveWorldY(1, { kind: "row-in-2d-slice", rowCount: 4 })).toBe(2);
      expect(resolveWorldY(1, { kind: "row-in-2d-slice", rowCount: 4 })).not.toBe(1);
    });
  });

  describe("slice-in-stack (a stack of XZ slices, no Y inside each slice)", () => {
    it("maps the first slice to Y=0", () => {
      expect(resolveWorldY(0, { kind: "slice-in-stack" })).toBe(0);
    });

    it("maps later slices to ascending Y, opposite direction from the row case", () => {
      // Asymmetric run of slice indices: 0, 1, 2, 3, 6 -- ascending
      // one-to-one with Y, the opposite direction from a Y-bearing slice's
      // rows. Deliberately not a mirrored/palindromic set of inputs.
      const ys = [0, 1, 2, 3, 6].map((slice) => resolveWorldY(slice, { kind: "slice-in-stack" }));
      expect(ys).toEqual([0, 1, 2, 3, 6]);
    });
  });
});
