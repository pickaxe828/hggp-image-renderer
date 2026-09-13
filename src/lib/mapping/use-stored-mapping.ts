import { useState } from 'react'
import { loadMapping } from './storage'
import type { Mapping } from './types'

/**
 * Loads any mapping previously persisted via ImportMapping, on mount.
 * Returns null when nothing has ever been imported (or the persisted data
 * was corrupted) — never throws.
 */
export function useStoredMapping(): Mapping | null {
  const [mapping] = useState<Mapping | null>(() => loadMapping())
  return mapping
}
