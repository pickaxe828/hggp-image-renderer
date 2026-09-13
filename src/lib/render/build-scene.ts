import { mergeModuleTable } from "@/lib/notation";
import type { Document, ModelContent, ModelLookup, ModuleTable } from "@/lib/notation";
import { resolveBlock } from "@/lib/mapping/resolve";
import type { Mapping } from "@/lib/mapping/types";
import { placeModelInWorld } from "./place-model.ts";
import type { PlacedScene } from "./types.ts";

export class NoRenderableModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoRenderableModelError";
  }
}

/**
 * Turns a parsed document into the ordered list of renderable scenes -- one
 * per top-level `identify` (`:=`) statement, i.e. one that isn't itself
 * referenced by glyph elsewhere in the document.
 *
 * A document's module blocks and `identify` statements accumulate in order
 * (module definitions threading a running substitution table, per
 * `lib/notation`'s own carry-across-models rule); `equivalence` (`==`)
 * statements define a sized word's model but aren't "a build" on their own,
 * so they're skipped here.
 *
 * WORKING ASSUMPTION, not specified anywhere in CLAUDE.md/issue #1: a
 * document may contain more than one `identify` statement, and earlier ones
 * are commonly reusable sub-components referenced by glyph (an `ElementRef`
 * module right-hand side) elsewhere in the document rather than builds in
 * their own right. This treats every `identify` statement whose element
 * name is never referenced that way as a top-level scene, and renders all
 * of them -- in document order -- rather than picking just one. A name
 * that's redefined by more than one `identify` statement uses its final
 * binding (later shadows earlier, same as the module table) but keeps the
 * position of its first appearance, so redefinition doesn't reorder scenes.
 * Every scene is placed against the document's fully-accumulated module
 * table and model set, not a per-statement snapshot -- the same
 * approximation the single-scene version made, just extended to more than
 * one target.
 */
export function buildScenes(document: Document, mapping: Mapping | null | undefined): PlacedScene[] {
  let table: ModuleTable = new Map();
  const models = new Map<string, ModelContent>();
  const referencedElementNames = new Set<string>();
  const rootOrder: string[] = [];
  const seenRoots = new Set<string>();

  for (const statement of document.statements) {
    if (statement.kind === "module") {
      table = mergeModuleTable(table, statement.definitions);
      for (const definition of statement.definitions) {
        if (definition.rhs.kind === "element") referencedElementNames.add(definition.rhs.name);
      }
    } else if (statement.kind === "identify") {
      models.set(statement.elementName, statement.model);
      if (!seenRoots.has(statement.elementName)) {
        seenRoots.add(statement.elementName);
        rootOrder.push(statement.elementName);
      }
    }
  }

  const rootNames = rootOrder.filter((name) => !referencedElementNames.has(name));

  if (rootNames.length === 0) {
    throw new NoRenderableModelError("Document defines no `[[ ]] := /name/` model to render.");
  }

  const lookupModel: ModelLookup = (name) => models.get(name);

  return rootNames.map((name) => {
    const model = models.get(name)!;
    const placedWords = placeModelInWorld(model, table, lookupModel, new Set([name]));
    return {
      name,
      blocks: placedWords.map((placedWord) => ({
        blockId: resolveBlock(placedWord.word, mapping),
        pos: placedWord.pos,
      })),
    };
  });
}
