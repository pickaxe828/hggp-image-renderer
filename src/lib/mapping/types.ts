/**
 * Shape of the JSON a user imports through the "Import mapping" UI.
 * Mirrors reference/hggp-block-mapping.schema.json.
 */
export interface Mapping {
  version: number;
  words: Record<string, string>;
}
