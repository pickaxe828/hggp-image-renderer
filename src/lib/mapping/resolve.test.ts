import { describe, expect, it } from "vitest";
import { resolveBlock, UNRESOLVED_BLOCK } from "./resolve";
import type { Mapping } from "./types";

describe("resolveBlock", () => {
  const mapping: Mapping = {
    version: 1,
    words: {
      $test1: "minecraft:stone",
      $test2: "minecraft:dirt",
    },
  };

  it("returns the mapped block id for a known word", () => {
    expect(resolveBlock("$test1", mapping)).toBe("minecraft:stone");
  });

  it("returns the placeholder sentinel for a word not present in the mapping", () => {
    expect(resolveBlock("$unknown", mapping)).toBe(UNRESOLVED_BLOCK);
  });

  it("returns the placeholder sentinel when the mapping is undefined", () => {
    expect(resolveBlock("$test1", undefined)).toBe(UNRESOLVED_BLOCK);
  });

  it("returns the placeholder sentinel when the mapping is null", () => {
    expect(resolveBlock("$test1", null)).toBe(UNRESOLVED_BLOCK);
  });
});
