import { mergeModuleTable } from "@/lib/notation";
import type { Document, ModelContent, ModelLookup, ModuleTable } from "@/lib/notation";
import { resolveBlock } from "@/lib/mapping/resolve";
import type { Mapping } from "@/lib/mapping/types";
import { placeModelInWorld } from "./place-model.ts";
import type { PlacedBlock } from "./types.ts";

export class NoRenderableModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoRenderableModelError";
  }
}

/**
 * Turns a parsed document into the flat list of resolved blocks to render.
 *
 * A document's module blocks and `identify` (`:=`) statements accumulate
 * in order (module definitions threading a running substitution table, per
 * `lib/notation`'s own carry-across-models rule); `equivalence` (`==`)
 * statements define a sized word's model but aren't "a build" on their
 * own, so they're skipped here.
 *
 * WORKING ASSUMPTION, not specified anywhere in CLAUDE.md/issue #1: a
 * document may contain more than one `identify` statement (earlier ones
 * commonly being reusable sub-components referenced by glyph elsewhere in
 * the document). This renders the *last* `identify` statement's model as
 * "the build" -- matching the single-statement reference example, and a
 * reasonable default for a document that defines components before the
 * assembly that uses them. If this default is wrong for real documents,
 * it's isolated to this one selection step.
 */
export function buildScene(document: Document, mapping: Mapping | null | undefined): PlacedBlock[] {
  let table: ModuleTable = new Map();
  const models = new Map<string, ModelContent>();
  let target: { model: ModelContent; elementName: string } | undefined;

  for (const statement of document.statements) {
    if (statement.kind === "module") {
      table = mergeModuleTable(table, statement.definitions);
    } else if (statement.kind === "identify") {
      models.set(statement.elementName, statement.model);
      target = { model: statement.model, elementName: statement.elementName };
    }
  }

  if (!target) {
    throw new NoRenderableModelError("Document defines no `[[ ]] := /name/` model to render.");
  }

  const lookupModel: ModelLookup = (name) => models.get(name);
  const placedWords = placeModelInWorld(target.model, table, lookupModel, new Set([target.elementName]));

  return placedWords.map((placedWord) => ({
    blockId: resolveBlock(placedWord.word, mapping),
    pos: placedWord.pos,
  }));
}
