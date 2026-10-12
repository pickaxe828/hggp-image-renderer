import { describe, expect, it } from "vitest";
import { validateMapping } from "./validate";

describe("validateMapping", () => {
  it("accepts a well-formed mapping", () => {
    const result = validateMapping({
      version: 1,
      words: { $test1: "minecraft:stone" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mapping.words["$test1"]).toBe("minecraft:stone");
    }
  });

  it("rejects non-object JSON", () => {
    const result = validateMapping("not an object");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/object/i);
  });

  it("rejects null", () => {
    const result = validateMapping(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/object/i);
  });

  it("rejects a missing version field", () => {
    const result = validateMapping({ words: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/i);
  });

  it("rejects a non-integer version field", () => {
    const result = validateMapping({ version: 1.5, words: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/i);
  });

  it("rejects a missing words field", () => {
    const result = validateMapping({ version: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/words/i);
  });

  it("rejects a words field that is not an object", () => {
    const result = validateMapping({ version: 1, words: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/words/i);
  });

  it("rejects a malformed block id in words", () => {
    const result = validateMapping({ version: 1, words: { $test1: "stone" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/\$test1/);
  });
});
