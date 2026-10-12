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
 * 1. Flatten the model into **text space**: every block gets a position
 *    along each text axis -- along its row (row-axis), down the page
 *    (column-axis), and by nesting order (slice-axis).
 * 2. Convert text space to world coordinates through the model's direction
 *    spec (its own, or the default for its nesting depth). Nothing else
 *    flips or swaps an axis.
 *
 * A cell resolves, possibly through one glyph hop, to one of three things:
 * a bare word (one block), a sized word (an extent -- tiles a uniform
 * sub-region of that same word), or a reference to another named element
 * (embeds that element's own content at this cell's position). All three
 * can size a cell to more than 1 along any text axis, so layout uses
 * cumulative offsets rather than assuming every cell in a row/column is the
 * same size. A row whose cells have different lengths along the column-axis
 * anchors each cell to the row's own first position.
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

/** A value per text axis: a position (0-based) or a length, depending on
 * where it is used. */
interface TextAxes {
  readonly rowAxis: number;
  readonly columnAxis: number;
  readonly sliceAxis: number;
}

type TextBlock = TextAxes & { readonly word: string };

interface Flattened {
  readonly blocks: readonly TextBlock[];
  /** Length of the content along each text axis. */
  readonly size: TextAxes;
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

type TextAxis = keyof TextAxes;

const TEXT_AXIS_LABEL: Record<TextAxis, string> = {
  rowAxis: "row-axis",
  columnAxis: "column-axis",
  sliceAxis: "slice-axis",
};

const WORLD_AXES = ["x", "y", "z", "t"] as const;
type WorldAxis = (typeof WORLD_AXES)[number];

function textAxisOf(glyph: DirectionGlyph): TextAxis | undefined {
  switch (glyph) {
    case ">":
    case "<":
      return "rowAxis";
    case "v":
    case "^":
      return "columnAxis";
    case "+":
    case "-":
      return "sliceAxis";
    case "_":
      return undefined;
  }
}

/** The world axes a spec assigns to each text axis. */
function carriers(spec: DirectionSpec): Record<TextAxis, WorldAxis[]> {
  const result: Record<TextAxis, WorldAxis[]> = {
    rowAxis: [],
    columnAxis: [],
    sliceAxis: [],
  };
  for (const axis of WORLD_AXES) {
    const textAxis = textAxisOf(spec[axis]);
    if (textAxis) result[textAxis].push(axis);
  }
  return result;
}

function validateSpec(spec: DirectionSpec): void {
  const byTextAxis = carriers(spec);
  for (const textAxis of Object.keys(byTextAxis) as TextAxis[]) {
    const worldAxes = byTextAxis[textAxis];
    if (worldAxes.length > 1) {
      throw new DirectionSpecError(
        `Direction spec assigns the ${TEXT_AXIS_LABEL[textAxis]} to more than one world axis (${worldAxes.map((a) => a.toUpperCase()).join(" and ")}).`
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

/** How long an extent is along each text axis, given which text axis each
 * of X, Y, Z lands on. */
function extentFootprint(extent: Extent, spec: DirectionSpec): TextAxes {
  const footprint = { rowAxis: 1, columnAxis: 1, sliceAxis: 1 };
  const sizes = { x: extent[0] ?? 1, y: extent[1] ?? 1, z: extent[2] ?? 1 };
  for (const axis of ["x", "y", "z"] as const) {
    const size = sizes[axis];
    const textAxis = textAxisOf(spec[axis]);
    if (textAxis) {
      footprint[textAxis] = size;
    } else if (size > 1) {
      throw new DirectionSpecError(
        `Extent <${extent.join(",")}> is ${size} long along ${axis.toUpperCase()}, but the direction spec marks ${axis.toUpperCase()} unused.`
      );
    }
  }
  return footprint;
}

function tile(word: string, size: TextAxes): Flattened {
  const blocks: TextBlock[] = [];
  for (let sliceAxis = 0; sliceAxis < size.sliceAxis; sliceAxis++)
    for (let columnAxis = 0; columnAxis < size.columnAxis; columnAxis++)
      for (let rowAxis = 0; rowAxis < size.rowAxis; rowAxis++)
        blocks.push({ word, rowAxis, columnAxis, sliceAxis });
  return { blocks, size };
}

const SINGLE_CELL: TextAxes = { rowAxis: 1, columnAxis: 1, sliceAxis: 1 };

function offsetInto(into: TextBlock[], sub: Flattened, offset: TextAxes): void {
  for (const b of sub.blocks)
    into.push({
      word: b.word,
      rowAxis: offset.rowAxis + b.rowAxis,
      columnAxis: offset.columnAxis + b.columnAxis,
      sliceAxis: offset.sliceAxis + b.sliceAxis,
    });
}

function flattenCell(
  resolved: ResolvedCellContent,
  ctx: FlattenContext,
  visited: ReadonlySet<string>
): Flattened {
  if (resolved.kind === "word") return tile(resolved.word, SINGLE_CELL);
  if (resolved.kind === "sized-word") {
    return tile(resolved.word, extentFootprint(resolved.extent, ctx.spec));
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
    return tile(danglingElementPlaceholderWord(resolved.name), SINGLE_CELL);
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
  let columnOffset = 0;
  let rowAxisLength = 0;
  let sliceAxisLength = 1;

  for (const row of slice.rows) {
    let rowOffset = 0;
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
      offsetInto(blocks, sub, {
        rowAxis: rowOffset,
        columnAxis: columnOffset,
        sliceAxis: 0,
      });
      rowOffset += sub.size.rowAxis;
      rowHeight = Math.max(rowHeight, sub.size.columnAxis);
      sliceAxisLength = Math.max(sliceAxisLength, sub.size.sliceAxis);
    }

    rowAxisLength = Math.max(rowAxisLength, rowOffset);
    columnOffset += rowHeight;
  }

  return {
    blocks,
    size: {
      rowAxis: rowAxisLength,
      columnAxis: columnOffset,
      sliceAxis: sliceAxisLength,
    },
  };
}

function flattenStack3D(
  stack: Stack3D,
  ctx: FlattenContext,
  visited: ReadonlySet<string>
): Flattened {
  const blocks: TextBlock[] = [];
  let rowAxisLength = 0;
  let columnAxisLength = 0;
  let sliceOffset = 0;

  for (const slice of stack.slices) {
    if (slice.kind !== "slice2d") {
      throw new DirectionSpecError(
        "Nesting deeper than 2 levels isn't supported: a direction spec only has a row-axis, a column-axis and a slice-axis to place cells along."
      );
    }
    const sub = flattenSlice2D(slice, ctx, visited);
    offsetInto(blocks, sub, {
      rowAxis: 0,
      columnAxis: 0,
      sliceAxis: sliceOffset,
    });
    rowAxisLength = Math.max(rowAxisLength, sub.size.rowAxis);
    columnAxisLength = Math.max(columnAxisLength, sub.size.columnAxis);
    sliceOffset += sub.size.sliceAxis;
  }

  return {
    blocks,
    size: {
      rowAxis: rowAxisLength,
      columnAxis: columnAxisLength,
      sliceAxis: sliceOffset,
    },
  };
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
  block: TextAxes,
  size: TextAxes
): number {
  switch (glyph) {
    case ">":
      return block.rowAxis;
    case "<":
      return size.rowAxis - 1 - block.rowAxis;
    case "v":
      return size.columnAxis - 1 - block.columnAxis;
    case "^":
      return block.columnAxis;
    case "+":
      return block.sliceAxis;
    case "-":
      return size.sliceAxis - 1 - block.sliceAxis;
    case "_":
      return 0;
  }
}

/** How many positions a world axis spans, given the glyph that drives it. */
function worldSpan(glyph: DirectionGlyph, size: TextAxes): number {
  const textAxis = textAxisOf(glyph);
  return textAxis ? size[textAxis] : 1;
}

function requireCarried(spec: DirectionSpec, size: TextAxes): void {
  const byTextAxis = carriers(spec);
  const noun: Record<TextAxis, string> = {
    rowAxis: "cells along a row",
    columnAxis: "rows",
    sliceAxis: "slices",
  };
  for (const textAxis of Object.keys(byTextAxis) as TextAxis[]) {
    if (size[textAxis] > 1 && byTextAxis[textAxis].length === 0) {
      throw new DirectionSpecError(
        `The model has ${size[textAxis]} ${noun[textAxis]}, but the direction spec assigns the ${TEXT_AXIS_LABEL[textAxis]} to no world axis.`
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

  const { blocks, size } = flattenContent(
    model,
    { table, lookupModel, spec },
    visited
  );
  requireCarried(spec, size);

  const notices: string[] = [];
  const timeSlices = worldSpan(spec.t, size);
  if (timeSlices > 1) {
    notices.push(
      `This model has ${timeSlices} time slices (the T axis); only the first is rendered.`
    );
  }

  const words: PlacedWord[] = [];
  for (const block of blocks) {
    // Time is reserved: render time slice 0 only.
    if (worldCoordinate(spec.t, block, size) !== 0) continue;
    words.push({
      word: block.word,
      pos: [
        worldCoordinate(spec.x, block, size),
        worldCoordinate(spec.y, block, size),
        worldCoordinate(spec.z, block, size),
      ] as const,
    });
  }
  return { words, notices };
}
