import { CycleError } from "./ir.ts";
import type { Glyph, GlyphDefinition, ModelContent, ModuleRhs } from "./ir.ts";

/** The running glyph -> rhs substitution table. Definitions from earlier
 * modules stay bound; a later module's definitions shadow earlier ones for
 * the same glyph. */
export type ModuleTable = ReadonlyMap<Glyph, ModuleRhs>;

export class UndefinedGlyphError extends Error {
  constructor(glyph: string) {
    super(`Glyph "${glyph}" is not defined by any module in scope`);
    this.name = "UndefinedGlyphError";
  }
}

/** Merges a module block's definitions into a running table. Definitions
 * are applied in order, so a later definition of the same glyph (whether
 * within this block or a prior merge) shadows an earlier one. */
export function mergeModuleTable(
  base: ModuleTable,
  definitions: readonly GlyphDefinition[],
): ModuleTable {
  const table = new Map(base);
  for (const def of definitions) {
    table.set(def.glyph, def.rhs);
  }
  return table;
}

/** Flat lookup of a glyph's bound right-hand side. Throws if the glyph has
 * no binding anywhere in scope -- unlike element references, glyphs are not
 * permitted to be dangling. */
export function resolveGlyph(table: ModuleTable, glyph: Glyph): ModuleRhs {
  const rhs = table.get(glyph);
  if (!rhs) throw new UndefinedGlyphError(glyph);
  return rhs;
}

/** Looks up the model content that a named language element depicts (via an
 * `identify` statement elsewhere in the document). */
export type ModelLookup = (name: string) => ModelContent | undefined;

/**
 * Resolves a named element to its model content, walking through any glyph
 * cells inside that content which themselves reference other elements (a
 * graph walk, not a flat lookup).
 *
 * - An element with no `identify` statement defining it is a valid dangling
 *   forward reference: returns `undefined`, not an error.
 * - An element whose content transitively refers back to itself (directly
 *   or via other elements) is a real cycle: throws `CycleError`.
 */
export function resolveElement(
  lookupModel: ModelLookup,
  table: ModuleTable,
  name: string,
  visited: ReadonlySet<string> = new Set(),
): ModelContent | undefined {
  if (visited.has(name)) {
    throw new CycleError(
      `Cycle detected resolving element /${name}/ (path: ${[...visited, name].join(" -> ")})`,
    );
  }
  const content = lookupModel(name);
  if (!content) return undefined;

  const nextVisited = new Set(visited);
  nextVisited.add(name);
  walkForCycles(content, table, lookupModel, nextVisited);
  return content;
}

function walkForCycles(
  content: ModelContent,
  table: ModuleTable,
  lookupModel: ModelLookup,
  visited: ReadonlySet<string>,
): void {
  if (content.kind === "slice2d") {
    for (const row of content.rows) {
      for (const cell of row) {
        if (cell.kind !== "glyph") continue;
        const rhs = table.get(cell.glyph);
        if (rhs && rhs.kind === "element") {
          resolveElement(lookupModel, table, rhs.name, visited);
        }
      }
    }
    return;
  }
  for (const slice of content.slices) {
    walkForCycles(slice, table, lookupModel, visited);
  }
}
