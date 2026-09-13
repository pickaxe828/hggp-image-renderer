// IR types for hggp build notation.
//
// A Document is a sequence of Statements. `::=`, `:=`, and `==` are kept as
// distinct statement/node kinds throughout -- they are not interchangeable
// spellings of one "definition" concept.

/** A bracketed word's content, e.g. "$_", "@0", "!<$". Opaque -- never
 * interpreted, only carried through. */
export type Word = string;

/** A two-code-point glyph, e.g. "..", "@@", "~w". Opaque, separate namespace
 * from Word. */
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

export interface GlyphCell {
  readonly kind: "glyph";
  readonly glyph: Glyph;
}

export type Row = Cell[];

/** The content of a `[[ ]]` model: either a flat 2D grid of cell rows, or a
 * stack of nested 2D grids (the third axis, expressed by nesting `[[ ]]`
 * inside `[[ ]]`). */
export type ModelContent = Slice2D | Stack3D;

export interface Slice2D {
  readonly kind: "slice2d";
  readonly rows: Row[];
}

export interface Stack3D {
  readonly kind: "stack3d";
  readonly slices: ModelContent[];
}

/** `[[ ... ]] := /name/` -- identify: this model IS the existing element
 * `name`. */
export interface IdentifyStatement {
  readonly kind: "identify";
  readonly model: ModelContent;
  readonly elementName: string;
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
