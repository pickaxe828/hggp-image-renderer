import type { Mapping } from './types'

export type ValidateMappingResult = { ok: true; mapping: Mapping } | { ok: false; error: string }

// Keep in sync with the `words` pattern in
// reference/hggp-block-mapping.schema.json.
const BLOCK_ID_PATTERN = /^minecraft:[a-z0-9_]+$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates `data` against the shape described by
 * reference/hggp-block-mapping.schema.json. Returns a distinguishable error
 * message per failure mode so the UI can surface exactly what was wrong.
 */
export function validateMapping(data: unknown): ValidateMappingResult {
  if (!isPlainObject(data)) {
    return { ok: false, error: 'Mapping must be a JSON object.' }
  }

  const { version, words, places } = data

  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, error: '"version" must be an integer.' }
  }

  if (!isPlainObject(words)) {
    return { ok: false, error: '"words" must be an object mapping hggp words to Minecraft block ids.' }
  }

  for (const [word, blockId] of Object.entries(words)) {
    if (typeof blockId !== 'string' || !BLOCK_ID_PATTERN.test(blockId)) {
      return {
        ok: false,
        error: `"words.${word}" must be a Minecraft block id matching ^minecraft:[a-z0-9_]+$ (got ${JSON.stringify(blockId)}).`,
      }
    }
  }

  if (places !== undefined) {
    if (!isPlainObject(places)) {
      return { ok: false, error: '"places", if present, must be an object.' }
    }
    for (const [place, value] of Object.entries(places)) {
      if (typeof value !== 'string') {
        return { ok: false, error: `"places.${place}" must be a string (got ${JSON.stringify(value)}).` }
      }
    }
  }

  const mapping: Mapping = places !== undefined
    ? { version, words: words as Record<string, string>, places: places as Record<string, string> }
    : { version, words: words as Record<string, string> }

  return { ok: true, mapping }
}
