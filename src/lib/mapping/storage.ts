import { validateMapping } from "./validate";
import type { Mapping } from "./types";

/** localStorage key the imported mapping is persisted under. */
export const MAPPING_STORAGE_KEY = "hggp-block-mapping";

export function saveMapping(mapping: Mapping): void {
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping));
}

/**
 * Loads a previously-imported mapping. Defensive: any failure (missing key,
 * malformed JSON, schema-invalid contents) is treated as "no mapping" and
 * returns null rather than throwing.
 */
export function loadMapping(): Mapping | null {
  const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = validateMapping(parsed);
  return result.ok ? result.mapping : null;
}
