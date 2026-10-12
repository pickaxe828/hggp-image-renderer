import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { MAPPING_STORAGE_KEY } from "./storage";
import { useStoredMapping } from "./use-stored-mapping";

describe("useStoredMapping", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has ever been imported", () => {
    const { result } = renderHook(() => useStoredMapping());
    expect(result.current).toBeNull();
  });

  it("returns a previously persisted mapping on mount", () => {
    localStorage.setItem(
      MAPPING_STORAGE_KEY,
      JSON.stringify({ version: 1, words: { $test1: "minecraft:stone" } })
    );
    const { result } = renderHook(() => useStoredMapping());
    expect(result.current).toEqual({
      version: 1,
      words: { $test1: "minecraft:stone" },
    });
  });
});
