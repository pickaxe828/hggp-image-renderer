import type { Mapping } from "./types";

/**
 * Sentinel returned when a word cannot be resolved to a block, either
 * because no mapping has been imported or the word is absent from it.
 * Never collides with a real `minecraft:*` block id.
 */
export const UNRESOLVED_BLOCK = "unresolved";

/**
 * Flat exact-string lookup of `word` against `mapping.words`. No morphology
 * parsing of any kind is performed on `word`.
 */
export function resolveBlock(
  word: string,
  mapping: Mapping | undefined | null
): string {
  if (!mapping) return UNRESOLVED_BLOCK;
  return mapping.words[word] ?? UNRESOLVED_BLOCK;
}
