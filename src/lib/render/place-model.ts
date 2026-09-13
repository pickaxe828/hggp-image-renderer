import { expandExtent, resolveElement, resolveGlyph } from "@/lib/notation";
import type { Cell, Extent, ModelContent, ModelLookup, ModuleTable, Slice2D, Stack3D } from "@/lib/notation";
import { resolveWorldY } from "./world-y.ts";
import type { PlacedWord } from "./types.ts";

/**
 * Flattens notation IR (post module-resolution, post-extent-expansion) into
 * placed words, in world-space grid coordinates (1 unit = 1 block).
 *
 * A cell resolves, possibly through one glyph hop, to one of three things:
 * a bare word (one block), a sized word (an extent -- tiles a uniform
 * sub-region of that same word), or a reference to another named element
 * (embeds that element's own content at this cell's position). All three
 * can size a cell to more than 1x1, so placement uses cumulative offsets
 * rather than assuming every cell in a row/column is the same size.
 *
 * Two coordinate schemes, matching CLAUDE.md's "Row order vs Y" split:
 * - A standalone 2D slice is the XY plane: columns are local u (-> world
 *   X), rows are local v, flipped to world Y by `resolveWorldY` (the only
 *   place that flip happens -- see `placeModelInWorld`).
 * - A stack of XZ slices: within a slice, columns are local u (-> world
 *   X) and rows are local v (-> world Z, not flipped -- Z isn't the axis
 *   the working assumption reverses); the slice index (-> world Y) is
 *   flipped by `resolveWorldY` at the top level, in the opposite direction
 *   from the 2D-slice case.
 *
 * Nested content (an extent's tiled sub-region, or an embedded element)
 * doesn't get a flip of its own: every cell -- however deep -- counts
 * top-down into one running local-v total for the whole 2D slice, and
 * `resolveWorldY` is applied exactly once, at the top, using that total as
 * `rowCount`. A row whose cells resolve to different heights (e.g. a
 * 2-row-tall embedded element next to a plain 1-row cell) is anchored to
 * the row's own top edge -- the shorter cell gets the same (higher) world
 * Y as the taller cell's first row, not its last.
 */

interface LocalBlock2D {
  readonly word: string;
  readonly u: number;
  readonly v: number;
}

interface FlattenedSlice {
  readonly blocks: readonly LocalBlock2D[];
  readonly width: number;
  readonly height: number;
}

interface LocalBlock3D {
  readonly word: string;
  readonly u: number;
  readonly v: number;
  readonly w: number;
}

type ResolvedCellContent =
  | { readonly kind: "word"; readonly word: string }
  | { readonly kind: "sized-word"; readonly word: string; readonly extent: Extent }
  | { readonly kind: "element"; readonly name: string };

function resolveCellContent(cell: Cell, table: ModuleTable): ResolvedCellContent {
  if (cell.kind === "word") {
    return cell.extent
      ? { kind: "sized-word", word: cell.word, extent: cell.extent }
      : { kind: "word", word: cell.word };
  }
  const rhs = resolveGlyph(table, cell.glyph);
  if (rhs.kind === "element") return { kind: "element", name: rhs.name };
  return rhs.extent
    ? { kind: "sized-word", word: rhs.word, extent: rhs.extent }
    : { kind: "word", word: rhs.word };
}

/**
 * A stand-in "word" for a cell whose element reference is dangling (valid
 * per the language, but nothing to actually place). Deliberately shaped so
 * it can never collide with a real hggp word (which never contains `/`):
 * `resolveBlock` will look it up in the mapping, fail to find it, and fall
 * back to `UNRESOLVED_BLOCK` like any other unresolved word.
 */
function danglingElementPlaceholderWord(elementName: string): string {
  return `/${elementName}/ (unresolved element)`;
}

function flattenSlice2D(
  slice: Slice2D,
  table: ModuleTable,
  lookupModel: ModelLookup,
  visited: ReadonlySet<string>,
): FlattenedSlice {
  const blocks: LocalBlock2D[] = [];
  let vOffset = 0;
  let width = 0;

  for (const row of slice.rows) {
    let uOffset = 0;
    let rowHeight = 1;

    for (const cell of row) {
      const resolved = resolveCellContent(cell, table);
      let cellWidth = 1;
      let cellHeight = 1;

      if (resolved.kind === "word") {
        blocks.push({ word: resolved.word, u: uOffset, v: vOffset });
      } else if (resolved.kind === "sized-word") {
        const expanded = expandExtent({ kind: "word", word: resolved.word }, resolved.extent);
        if (expanded.kind !== "slice2d") {
          throw new Error(
            `A 3-axis extent on a word used as a 2D-slice cell is not supported: <${resolved.extent.join(",")}>`,
          );
        }
        const sub = flattenSlice2D(expanded, table, lookupModel, visited);
        for (const b of sub.blocks) blocks.push({ word: b.word, u: uOffset + b.u, v: vOffset + b.v });
        cellWidth = sub.width;
        cellHeight = sub.height;
      } else {
        const content = resolveElement(lookupModel, table, resolved.name, visited);
        if (content === undefined) {
          // A dangling element reference (no `identify` statement defines
          // it) is valid notation -- see lib/notation/modules.ts's
          // `resolveElement` doc comment -- unlike an undefined glyph,
          // which is not (see `resolveGlyph`, which throws). Degrade to a
          // single placeholder cell rather than failing the whole render,
          // matching this project's established "render placeholders,
          // never fail on missing data" policy for unresolved words. The
          // reference example in CLAUDE.md exercises exactly this case
          // (`@@ ::= /@/`, with `/@/` never defined).
          blocks.push({ word: danglingElementPlaceholderWord(resolved.name), u: uOffset, v: vOffset });
        } else if (content.kind !== "slice2d") {
          throw new Error(`Element /${resolved.name}/ is a 3D stack and can't be embedded as a 2D-slice cell`);
        } else {
          const nextVisited = new Set(visited);
          nextVisited.add(resolved.name);
          const sub = flattenSlice2D(content, table, lookupModel, nextVisited);
          for (const b of sub.blocks) blocks.push({ word: b.word, u: uOffset + b.u, v: vOffset + b.v });
          cellWidth = sub.width;
          cellHeight = sub.height;
        }
      }

      uOffset += cellWidth;
      rowHeight = Math.max(rowHeight, cellHeight);
    }

    width = Math.max(width, uOffset);
    vOffset += rowHeight;
  }

  return { blocks, width, height: vOffset };
}

function flattenStack3D(
  stack: Stack3D,
  table: ModuleTable,
  lookupModel: ModelLookup,
  visited: ReadonlySet<string>,
): { blocks: LocalBlock3D[]; width: number; depth: number } {
  const blocks: LocalBlock3D[] = [];
  let width = 0;
  let depth = 0;

  for (let w = 0; w < stack.slices.length; w++) {
    const slice = stack.slices[w];
    if (slice.kind !== "slice2d") {
      throw new Error("A slice within a 3D stack must itself be a flat 2D slice (deeper nesting isn't supported)");
    }
    const sub = flattenSlice2D(slice, table, lookupModel, visited);
    for (const b of sub.blocks) blocks.push({ word: b.word, u: b.u, v: b.v, w });
    width = Math.max(width, sub.width);
    depth = Math.max(depth, sub.height);
  }

  return { blocks, width, depth };
}

/**
 * Places a resolved model's content into world-space grid coordinates.
 * `visited` seeds cycle detection for element references reachable from
 * `model` -- pass the model's own element name (if it has one, i.e. it's
 * an `identify` statement's model) so a cycle back to itself is caught,
 * not just cycles among the elements it references.
 */
export function placeModelInWorld(
  model: ModelContent,
  table: ModuleTable,
  lookupModel: ModelLookup,
  visited: ReadonlySet<string> = new Set(),
): PlacedWord[] {
  if (model.kind === "slice2d") {
    const { blocks, height } = flattenSlice2D(model, table, lookupModel, visited);
    return blocks.map((b) => ({
      word: b.word,
      pos: [b.u, resolveWorldY(b.v, { kind: "row-in-2d-slice", rowCount: height }), 0] as const,
    }));
  }

  const { blocks } = flattenStack3D(model, table, lookupModel, visited);
  return blocks.map((b) => ({
    word: b.word,
    pos: [b.u, resolveWorldY(b.w, { kind: "slice-in-stack" }), b.v] as const,
  }));
}
