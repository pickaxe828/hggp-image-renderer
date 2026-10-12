import { resolveElement, resolveGlyph, resolveRowCells } from "@/lib/notation";
import type {
  Cell,
  DirectionGlyph,
  DirectionSpec,
  Extent,
  ModelContent,
  ModelLookup,
  ModuleTable,
  Slice2D,
  Stack3D,
} from "@/lib/notation";
import type { PlacedWord } from "./types.ts";

/**
 * Flattens notation IR (post module-resolution) into placed words, in
 * world-space grid coordinates (1 unit = 1 block; X east, Y up, Z south).
 *
 * Placement happens in two steps, so there is exactly one place where text
 * becomes world:
 *
 * 1. Flatten the model into **text space**: every block gets a (column,
 *    row, slice) position on the page -- column along a row (row-axis), row
 *    down the page (column-axis), slice by nesting order (slice-axis).
 * 2. Convert text space to world coordinates through the model's direction
 *    spec (its own, or the default for its nesting depth). Nothing else
 *    flips or swaps an axis.
 *
 * A cell resolves, possibly through one glyph hop, to one of three things:
 * a bare word (one block), a sized word (an extent -- tiles a uniform
 * sub-region of that same word), or a reference to another named element
 * (embeds that element's own content at this cell's position). All three
 * can size a cell to more than 1x1x1, so layout uses cumulative offsets
 * rather than assuming every cell in a row/column is the same size. A row
 * whose cells have different heights anchors each cell to the row's own top
 * edge.
 *
 * An extent stays in world-axis order `<X,Y,Z>`; its footprint on the page
 * is converted through the spec (X on the column-axis makes `<3,2>` 3 rows
 * tall). Embedded element content is laid out in the embedding model's text
 * space and follows the embedding model's spec, not its own.
 */

export class DirectionSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectionSpecError";
  }
}

/** Result of placing one model: its blocks plus any notices the viewer
 * should show alongside them (e.g. extra time slices that were skipped). */
export interface PlacedModel {
  readonly words: PlacedWord[];
  readonly notices: string[];
}

interface TextBlock {
  readonly word: string;
  readonly c: number;
  readonly r: number;
  readonly s: number;
}

interface Flattened {
  readonly blocks: readonly TextBlock[];
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

interface FlattenContext {
  readonly table: ModuleTable;
  readonly lookupModel: ModelLookup;
  readonly spec: DirectionSpec;
}

type ResolvedCellContent =
  | { readonly kind: "word"; readonly word: string }
  | {
      readonly kind: "sized-word";
      readonly word: string;
      readonly extent: Extent;
    }
  | { readonly kind: "element"; readonly name: string };

const DEFAULT_2D: DirectionSpec = { x: ">", y: "v", z: "_", t: "_" };
const DEFAULT_3D: DirectionSpec = { x: ">", y: "v", z: "+", t: "_" };

type TextAxis = "row-axis" | "column-axis" | "slice-axis";

const WORLD_AXES = ["x", "y", "z", "t"] as const;

function textAxisOf(glyph: DirectionGlyph): TextAxis | undefined {
  switch (glyph) {
    case ">":
    case "<":
      return "row-axis";
    case "v":
    case "^":
      return "column-axis";
    case "+":
    case "-":
      return "slice-axis";
    case "_":
      return undefined;
  }
}

/** The world axes (upper-case names) a spec assigns to each text axis. */
function carriers(spec: DirectionSpec): Record<TextAxis, string[]> {
  const result: Record<TextAxis, string[]> = {
    "row-axis": [],
    "column-axis": [],
    "slice-axis": [],
  };
  for (const axis of WORLD_AXES) {
    const textAxis = textAxisOf(spec[axis]);
    if (textAxis) result[textAxis].push(axis.toUpperCase());
  }
  return result;
}

function validateSpec(spec: DirectionSpec): void {
  const byTextAxis = carriers(spec);
  for (const textAxis of Object.keys(byTextAxis) as TextAxis[]) {
    const worldAxes = byTextAxis[textAxis];
    if (worldAxes.length > 1) {
      throw new DirectionSpecError(
        `Direction spec assigns the ${textAxis} to more than one world axis (${worldAxes.join(" and ")}).`
      );
    }
  }
}

function resolveCellContent(
  cell: Cell,
  table: ModuleTable
): ResolvedCellContent {
  if (cell.kind === "word") {
    return cell.extent
      ? { kind: "sized-word", word: cell.word, extent: cell.extent }
      : { kind: "word", word: cell.word };
  }
  const rhs = resolveGlyph(table, cell.text);
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

/** How many columns / rows / slices an extent covers on the page, given
 * which text axis each of X, Y, Z lands on. */
function extentFootprint(
  extent: Extent,
  spec: DirectionSpec
): { width: number; height: number; depth: number } {
  const footprint = { width: 1, height: 1, depth: 1 };
  const sizes = { x: extent[0] ?? 1, y: extent[1] ?? 1, z: extent[2] ?? 1 };
  for (const axis of ["x", "y", "z"] as const) {
    const size = sizes[axis];
    const textAxis = textAxisOf(spec[axis]);
    if (!textAxis) {
      if (size > 1) {
        throw new DirectionSpecError(
          `Extent <${extent.join(",")}> is ${size} long along ${axis.toUpperCase()}, but the direction spec marks ${axis.toUpperCase()} unused.`
        );
      }
    } else if (textAxis === "row-axis") footprint.width = size;
    else if (textAxis === "column-axis") footprint.height = size;
    else footprint.depth = size;
  }
  return footprint;
}

function tile(
  word: string,
  width: number,
  height: number,
  depth: number
): Flattened {
  const blocks: TextBlock[] = [];
  for (let s = 0; s < depth; s++)
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) blocks.push({ word, c, r, s });
  return { blocks, width, height, depth };
}

function offsetInto(
  into: TextBlock[],
  sub: Flattened,
  c: number,
  r: number,
  s: number
): void {
  for (const b of sub.blocks)
    into.push({ word: b.word, c: c + b.c, r: r + b.r, s: s + b.s });
}

function flattenCell(
  resolved: ResolvedCellContent,
  ctx: FlattenContext,
  visited: ReadonlySet<string>
): Flattened {
  if (resolved.kind === "word") return tile(resolved.word, 1, 1, 1);
  if (resolved.kind === "sized-word") {
    const { width, height, depth } = extentFootprint(resolved.extent, ctx.spec);
    return tile(resolved.word, width, height, depth);
  }

  const content = resolveElement(
    ctx.lookupModel,
    ctx.table,
    resolved.name,
    visited
  );
  if (content === undefined) {
    // A dangling element reference (no `identify` statement defines it) is
    // valid notation -- see lib/notation/modules.ts's `resolveElement` doc
    // comment -- unlike an undefined glyph, which is not (see
    // `resolveGlyph`, which throws). Degrade to a single placeholder cell
    // rather than failing the whole render, matching this project's
    // established "render placeholders, never fail on missing data" policy
    // for unresolved words. The reference example in CLAUDE.md exercises
    // exactly this case (`@@ ::= /@/`, with `/@/` never defined).
    return tile(danglingElementPlaceholderWord(resolved.name), 1, 1, 1);
  }
  const nextVisited = new Set(visited);
  nextVisited.add(resolved.name);
  return flattenContent(content, ctx, nextVisited);
}

function flattenSlice2D(
  slice: Slice2D,
  ctx: FlattenContext,
  visited: ReadonlySet<string>
): Flattened {
  const blocks: TextBlock[] = [];
  let rOffset = 0;
  let width = 0;
  let depth = 1;

  for (const row of slice.rows) {
    let cOffset = 0;
    let rowHeight = 1;

    // A raw glyph-run cell can hold more than one grid cell's worth of
    // glyphs (see GlyphCell in ir.ts) -- expand against this scene's table
    // before laying cells out left to right.
    for (const cell of resolveRowCells(row, ctx.table)) {
      const sub = flattenCell(
        resolveCellContent(cell, ctx.table),
        ctx,
        visited
      );
      offsetInto(blocks, sub, cOffset, rOffset, 0);
      cOffset += sub.width;
      rowHeight = Math.max(rowHeight, sub.height);
      depth = Math.max(depth, sub.depth);
    }

    width = Math.max(width, cOffset);
    rOffset += rowHeight;
  }

  return { blocks, width, height: rOffset, depth };
}

function flattenStack3D(
  stack: Stack3D,
  ctx: FlattenContext,
  visited: ReadonlySet<string>
): Flattened {
  const blocks: TextBlock[] = [];
  let width = 0;
  let height = 0;
  let sOffset = 0;

  for (const slice of stack.slices) {
    if (slice.kind !== "slice2d") {
      throw new DirectionSpecError(
        "Nesting deeper than 2 levels isn't supported: a direction spec only has a row-axis, a column-axis and a slice-axis to place cells along."
      );
    }
    const sub = flattenSlice2D(slice, ctx, visited);
    offsetInto(blocks, sub, 0, 0, sOffset);
    width = Math.max(width, sub.width);
    height = Math.max(height, sub.height);
    sOffset += sub.depth;
  }

  return { blocks, width, height, depth: sOffset };
}

function flattenContent(
  content: ModelContent,
  ctx: FlattenContext,
  visited: ReadonlySet<string>
): Flattened {
  return content.kind === "slice2d"
    ? flattenSlice2D(content, ctx, visited)
    : flattenStack3D(content, ctx, visited);
}

/** A world coordinate for a block, from the glyph that drives that axis. */
function worldCoordinate(
  glyph: DirectionGlyph,
  block: TextBlock,
  size: { width: number; height: number; depth: number }
): number {
  switch (glyph) {
    case ">":
      return block.c;
    case "<":
      return size.width - 1 - block.c;
    case "v":
      return size.height - 1 - block.r;
    case "^":
      return block.r;
    case "+":
      return block.s;
    case "-":
      return size.depth - 1 - block.s;
    case "_":
      return 0;
  }
}

/** How many positions a world axis spans, given the glyph that drives it. */
function worldSpan(
  glyph: DirectionGlyph,
  size: { width: number; height: number; depth: number }
): number {
  switch (textAxisOf(glyph)) {
    case "row-axis":
      return size.width;
    case "column-axis":
      return size.height;
    case "slice-axis":
      return size.depth;
    case undefined:
      return 1;
  }
}

function requireCarried(
  spec: DirectionSpec,
  size: { width: number; height: number; depth: number }
): void {
  const byTextAxis = carriers(spec);
  const used: [TextAxis, number, string][] = [
    ["row-axis", size.width, "columns"],
    ["column-axis", size.height, "rows"],
    ["slice-axis", size.depth, "slices"],
  ];
  for (const [textAxis, count, noun] of used) {
    if (count > 1 && byTextAxis[textAxis].length === 0) {
      throw new DirectionSpecError(
        `The model has ${count} ${noun}, but the direction spec assigns the ${textAxis} to no world axis.`
      );
    }
  }
}

/**
 * Places a resolved model's content into world-space grid coordinates.
 * `visited` seeds cycle detection for element references reachable from
 * `model` -- pass the model's own element name (if it has one, i.e. it's
 * an `identify` statement's model) so a cycle back to itself is caught,
 * not just cycles among the elements it references.
 *
 * Throws `DirectionSpecError` for a spec that can't describe the model.
 */
export function placeModelInWorld(
  model: ModelContent,
  table: ModuleTable,
  lookupModel: ModelLookup,
  visited: ReadonlySet<string> = new Set()
): PlacedModel {
  const spec =
    model.direction ?? (model.kind === "slice2d" ? DEFAULT_2D : DEFAULT_3D);
  validateSpec(spec);

  const flat = flattenContent(model, { table, lookupModel, spec }, visited);
  requireCarried(spec, flat);

  const notices: string[] = [];
  const timeSlices = worldSpan(spec.t, flat);
  if (timeSlices > 1) {
    notices.push(
      `This model has ${timeSlices} time slices (the T axis); only the first is rendered.`
    );
  }

  const words: PlacedWord[] = [];
  for (const block of flat.blocks) {
    // Time is reserved: render time slice 0 only.
    if (worldCoordinate(spec.t, block, flat) !== 0) continue;
    words.push({
      word: block.word,
      pos: [
        worldCoordinate(spec.x, block, flat),
        worldCoordinate(spec.y, block, flat),
        worldCoordinate(spec.z, block, flat),
      ] as const,
    });
  }
  return { words, notices };
}
