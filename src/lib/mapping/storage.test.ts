import { beforeEach, describe, expect, it } from 'vitest'
import { loadMapping, saveMapping, MAPPING_STORAGE_KEY } from './storage'
import fixtureMapping from './__fixtures__/fixture-mapping.json'
import type { Mapping } from './types'

describe('mapping storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing has been saved', () => {
    expect(loadMapping()).toBeNull()
  })

  it('round-trips a saved mapping', () => {
    saveMapping(fixtureMapping as Mapping)
    expect(loadMapping()).toEqual(fixtureMapping)
  })

  it('persists under the documented storage key', () => {
    saveMapping(fixtureMapping as Mapping)
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).not.toBeNull()
  })

  it('returns null when the stored value is not valid JSON', () => {
    localStorage.setItem(MAPPING_STORAGE_KEY, 'not json{')
    expect(loadMapping()).toBeNull()
  })

  it('returns null when the stored value fails schema validation', () => {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify({ version: 1 }))
    expect(loadMapping()).toBeNull()
  })
})
