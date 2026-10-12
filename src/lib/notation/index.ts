export type {
  Cell,
  DirectionGlyph,
  DirectionSpec,
  Document,
  ElementRef,
  Extent,
  Glyph,
  GlyphCell,
  GlyphDefinition,
  IdentifyStatement,
  ModelContent,
  ModuleBlock,
  ModuleRhs,
  Row,
  Slice2D,
  Stack3D,
  Statement,
  EquivalenceStatement,
  Word,
  WordRef,
} from "./ir.ts";
export { CycleError, UndefinedGlyphError } from "./ir.ts";

export { tokenizeGlyphRow } from "./tokenizer.ts";

export { expandExtent } from "./extents.ts";

export type { ModelLookup, ModuleTable } from "./modules.ts";
export {
  mergeModuleTable,
  resolveElement,
  resolveGlyph,
  resolveRowCells,
} from "./modules.ts";

export { parseDocument } from "./parser.ts";
export { serializeDocument } from "./serializer.ts";
