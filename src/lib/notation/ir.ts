// IR types for hggp build notation.
//
// A Document is a sequence of Statements. `::=`, `:=`, and `==` are kept as
// distinct statement/node kinds throughout -- they are not interchangeable
// spellings of one "definition" concept.

/** A bracketed word's content, e.g. "$_", "@0", "!<$". Opaque -- never
 * interpreted, only carried through. */
export type Word = string;

/** A glyph as bound by a module: 1 or 2 code points, e.g. "#", "..", "@@",
 * "~w". Opaque, separate namespace from Word. */
export type Glyph = string;

/** An extent suffix, e.g. <3> -> [3], <3,3> -> [3,3], <3,3,3> -> [3,3,3].
 * Axis order is [X, Y, Z] (as many axes as given), each ascending. */
export type Extent = number[];

/** A bracketed word reference, optionally sized by an extent: [$_] or
 * [$_]<8,8>. */
export interface WordRef {
  readonly kind: "word";
  readonly word: Word;
  readonly extent?: Extent;
}

/** A reference to an existing language element, e.g. /@/ or /C/. */
export interface ElementRef {
  readonly kind: "element";
  readonly name: string;
}

/** Right-hand side of a module glyph definition: either a sized word or a
 * reference to an existing language element. */
export type ModuleRhs = WordRef | ElementRef;

/** One `<glyph> ::= <rhs>;` statement inside a module. */
export interface GlyphDefinition {
  readonly kind: "definition";
  readonly glyph: Glyph;
  readonly rhs: ModuleRhs;
}

/** A `---`-delimited legend: a list of glyph definitions. Modules are not
 * scoped to a single model -- definitions from earlier modules stay in
 * effect (and can be shadowed) for every model that follows in the
 * document. */
export interface ModuleBlock {
  readonly kind: "module";
  readonly definitions: GlyphDefinition[];
}

/** A single cell in a 2D model: either an inline bracketed word or a
 * glyph shorthand (resolved later via the running module table). */
export type Cell = WordRef | GlyphCell;

/**
 * A raw, unsplit run of glyph-shorthand text -- e.g. an entire row like
 * "......@@...." with no bracketed words in it is ONE `GlyphCell`, not one
 * per two-character glyph. Glyphs are 1 or 2 code points wide (per-glyph,
 * not fixed document-wide), so splitting `text` into individual glyphs
 * requires knowing which widths are actually bound in the module table --
 * information parsing deliberately doesn't have (same reasoning as why
 * extents are kept as metadata rather than expanded at parse time). See
 * `resolveRowCells` in modules.ts for that split, run against a specific
 * scene's module table.
 */
export interface GlyphCell {
  readonly kind: "glyph";
  readonly text: string;
}

export type Row = Cell[];

/** One entry of a direction spec. `>` / `<` put a world axis on the
 * row-axis (rising / falling to the right), `v` / `^` on the column-axis
 * (falling / rising going down), `+` / `-` on the slice-axis (rising /
 * falling with nesting order), `_` marks the world axis unused. */
export type DirectionGlyph = ">" | "<" | "v" | "^" | "+" | "-" | "_";

/** A model's direction spec: which signed text axis drives each world axis.
 * Always fully populated -- entries the notation left out are `_` -- so
 * `<(/>v+/)>` and `<(/>v+_/)>` parse to the same value. */
export interface DirectionSpec {
  readonly x: DirectionGlyph;
  readonly y: DirectionGlyph;
  readonly z: DirectionGlyph;
  readonly t: DirectionGlyph;
}

/** The content of a `[[ ]]` model: either a flat 2D grid of cell rows, or a
 * stack of nested 2D grids (the third axis, expressed by nesting `[[ ]]`
 * inside `[[ ]]`).
 *
 * `direction` is the model's own direction spec, set only on the outermost
 * `[[ ]]` of a statement's model. Absent means "no spec written" (the
 * default for the model's nesting depth applies); an explicit spec equal to
 * that default is still kept, so export can write back what the author wrote. */
export type ModelContent = Slice2D | Stack3D;

export interface Slice2D {
  readonly kind: "slice2d";
  readonly rows: Row[];
  readonly direction?: DirectionSpec;
}

export interface Stack3D {
  readonly kind: "stack3d";
  readonly slices: ModelContent[];
  readonly direction?: DirectionSpec;
}

/** `[[ ... ]] := /name/` -- identify: this model IS the existing element
 * `name`. The `:= /name/` suffix itself is optional: a bare `[[ ... ]];`
 * model is valid too, it just has no name to be referenced by elsewhere in
 * the document or shown as a title -- see `elementName`. */
export interface IdentifyStatement {
  readonly kind: "identify";
  readonly model: ModelContent;
  readonly elementName?: string;
}

/** `word<extent> == [[ ... ]]` -- equivalence: a sized word and an explicit
 * model are the same thing. */
export interface EquivalenceStatement {
  readonly kind: "equivalence";
  readonly word: WordRef;
  readonly model: ModelContent;
}

export type Statement = ModuleBlock | IdentifyStatement | EquivalenceStatement;

export interface Document {
  readonly statements: Statement[];
}

export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CycleError";
  }
}

/** Lives here (rather than in modules.ts, which owns `resolveGlyph`) so
 * tokenizer.ts can throw it too, without an import cycle between the two --
 * ir.ts is the shared leaf both depend on. */
export class UndefinedGlyphError extends Error {
  constructor(glyph: string) {
    super(`Glyph "${glyph}" is not defined by any module in scope`);
    this.name = "UndefinedGlyphError";
  }
}
