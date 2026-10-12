import { describe, expect, it } from "vitest";
import { parseDocument } from "@/lib/notation";
import type { Mapping } from "@/lib/mapping/types";
import { buildScenes } from "./build-scene.ts";

// Every word maps to its own block id, so a misplaced cell is visible as a
// different block at a position, not just a different count.
const mapping: Mapping = {
  version: 1,
  words: Object.fromEntries(
    "abcdefghijklmnopqrstuvwxyz".split("").map((w) => [w, `minecraft:${w}`])
  ),
};

/** Renders the first scene of `source` as `{ "x,y,z": "<word>" }`. */
function render(source: string): Record<string, string> {
  const [scene] = buildScenes(parseDocument(source), mapping);
  return Object.fromEntries(
    scene.blocks.map((b) => [b.pos.join(","), b.blockId.replace(/^.*:/, "")])
  );
}

function sceneOf(source: string) {
  return buildScenes(parseDocument(source), mapping)[0];
}

// 3 columns x 2 rows, every cell distinct.
const grid = (spec: string) => `
[[
  [a][b][c]
  [d][e][f]
]]${spec}:=/C/;`;

describe("buildScenes: direction spec on a 2D model", () => {
  it("defaults to X to the right and the top row highest (>v)", () => {
    expect(render(grid(""))).toEqual({
      "0,1,0": "a",
      "1,1,0": "b",
      "2,1,0": "c",
      "0,0,0": "d",
      "1,0,0": "e",
      "2,0,0": "f",
    });
  });

  it("treats an explicit >v exactly like the default", () => {
    expect(render(grid("<(/>v/)>"))).toEqual(render(grid("")));
  });

  it("draws a YZ wall with <(/_v>/)>: Y falls going down, Z rises to the right", () => {
    expect(render(grid("<(/_v>/)>"))).toEqual({
      "0,1,0": "a",
      "0,1,1": "b",
      "0,1,2": "c",
      "0,0,0": "d",
      "0,0,1": "e",
      "0,0,2": "f",
    });
  });

  it("draws an XZ floor with <(/>_v/)>: Z falls going down, so the top row has the highest Z", () => {
    expect(render(grid("<(/>_v/)>"))).toEqual({
      "0,0,1": "a",
      "1,0,1": "b",
      "2,0,1": "c",
      "0,0,0": "d",
      "1,0,0": "e",
      "2,0,0": "f",
    });
  });

  it("reverses the row-axis with < so X falls to the right", () => {
    expect(render(grid("<(/<v/)>"))).toMatchObject({
      "2,1,0": "a",
      "1,1,0": "b",
      "0,1,0": "c",
      "2,0,0": "d",
    });
  });

  it("reverses the column-axis with ^ so the bottom row is highest", () => {
    expect(render(grid("<(/>^/)>"))).toMatchObject({
      "0,0,0": "a",
      "2,0,0": "c",
      "0,1,0": "d",
      "2,1,0": "f",
    });
  });

  it("can put X on the column-axis and Y on the row-axis (<(/v>/)>)", () => {
    expect(render(grid("<(/v>/)>"))).toEqual({
      "1,0,0": "a",
      "1,1,0": "b",
      "1,2,0": "c",
      "0,0,0": "d",
      "0,1,0": "e",
      "0,2,0": "f",
    });
  });

  it("does not borrow from the default: <(/>/)> is X only, every row at Y=0 -- an error for a two-row model", () => {
    expect(() => render(grid("<(/>/)>"))).toThrow(/column-axis/);
  });

  it("lays a one-row model along any one axis with a short spec", () => {
    expect(render(`[[ [a][b][c] ]]</>/>;`)).toEqual({
      "0,0,0": "a",
      "1,0,0": "b",
      "2,0,0": "c",
    });
  });

  it("accepts an unused column-axis on a one-row model", () => {
    expect(render(`[[ [a][b] ]]<(/__>/)>;`)).toEqual({
      "0,0,0": "a",
      "0,0,1": "b",
    });
  });

  it("accepts a slice-axis assignment on a 2D model", () => {
    expect(render(grid("<(/>v+/)>"))).toEqual(render(grid("")));
  });

  it("does not let one model's spec affect the next model", () => {
    const scenes = buildScenes(
      parseDocument(`
[[ [a][b] ]]<(/__>/)>:=/first/;
[[ [c][d] ]]:=/second/;
`),
      mapping
    );
    expect(scenes[0].blocks.map((b) => [...b.pos])).toEqual([
      [0, 0, 0],
      [0, 0, 1],
    ]);
    expect(scenes[1].blocks.map((b) => [...b.pos])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
  });

  it("applies the host model's layout to embedded element content", () => {
    expect(
      render(`
[[ [p][q] ]]:=/part/;
---
%% ::= /part/;
---
[[ %%[r] ]]<(/__>/)>:=/host/;
`)
    ).toEqual({
      "0,0,0": "p",
      "0,0,1": "q",
      "0,0,2": "r",
    });
  });
});

describe("buildScenes: direction spec on a 3D model", () => {
  // 3 columns x 2 rows x 2 slices, every cell distinct.
  const stack = (spec: string) => `
[[
  [[
    [a][b][c]
    [d][e][f]
  ]]
  [[
    [g][h][i]
    [j][k][l]
  ]]
]]${spec}:=/S/;`;

  it("defaults to XY slices stacked along +Z (>v+)", () => {
    expect(render(stack(""))).toEqual({
      "0,1,0": "a",
      "1,1,0": "b",
      "2,1,0": "c",
      "0,0,0": "d",
      "1,0,0": "e",
      "2,0,0": "f",
      "0,1,1": "g",
      "1,1,1": "h",
      "2,1,1": "i",
      "0,0,1": "j",
      "1,0,1": "k",
      "2,0,1": "l",
    });
  });

  it("treats an explicit >v+ exactly like the default", () => {
    expect(render(stack("<(/>v+/)>"))).toEqual(render(stack("")));
  });

  it("reverses the slice-axis with - so the first nested slice is the highest", () => {
    expect(render(stack("<(/>v-/)>"))).toMatchObject({
      "0,1,1": "a",
      "0,1,0": "g",
    });
  });

  it("can stack XZ slices along +Y (<(/>+v/)>) on request", () => {
    expect(render(stack("<(/>+v/)>"))).toMatchObject({
      "0,0,1": "a",
      "0,0,0": "d",
      "2,0,1": "c",
      "0,1,1": "g",
      "0,1,0": "j",
    });
  });
});

describe("buildScenes: extents go through the spec", () => {
  it("lays a sized word's footprint out in X,Y order by default", () => {
    expect(render(`[[ [w]<3,2>[z] ]];`)).toEqual({
      "0,0,0": "w",
      "1,0,0": "w",
      "2,0,0": "w",
      "0,1,0": "w",
      "1,1,0": "w",
      "2,1,0": "w",
      // anchored to the row's top edge
      "3,1,0": "z",
    });
  });

  it("makes [w]<3,2> 3 rows tall when the spec puts X down the page", () => {
    expect(render(`[[ [w]<3,2>[z] ]]<(/v>/)>;`)).toEqual({
      "0,0,0": "w",
      "1,0,0": "w",
      "2,0,0": "w",
      "0,1,0": "w",
      "1,1,0": "w",
      "2,1,0": "w",
      "2,2,0": "z",
    });
  });

  it("converts a 3-axis extent in a YZ wall: Y down the page, Z across", () => {
    const blocks = render(`[[ [w]<1,2,3> ]]<(/_v>/)>;`);
    expect(Object.keys(blocks).sort()).toEqual(
      ["0,0,0", "0,0,1", "0,0,2", "0,1,0", "0,1,1", "0,1,2"].sort()
    );
  });

  it("rejects an extent that is larger than 1 along an unused axis", () => {
    expect(() => render(`[[ [w]<2,2,2> ]];`)).toThrow(/Z/);
  });
});

describe("buildScenes: direction spec errors", () => {
  it("rejects one text axis assigned to two world axes", () => {
    expect(() => render(grid("<(/>>/)>"))).toThrow(/row-axis/);
    expect(() => render(grid("<(/vv/)>"))).toThrow(/column-axis/);
    expect(() => render(grid("<(/>v+-/)>"))).toThrow(/slice-axis/);
  });

  it("rejects a text axis the model really uses that no world axis carries", () => {
    expect(() => render(grid("<(/_v/)>"))).toThrow(/row-axis/);
    expect(() => render(grid("<(/>_/)>"))).toThrow(/column-axis/);
    expect(() => render(`[[ [[ [a] ]] [[ [b] ]] ]]<(/>v/)>;`)).toThrow(
      /slice-axis/
    );
  });

  it("rejects nesting deeper than 2 levels", () => {
    expect(() => render(`[[ [[ [[ [a] ]] ]] ]];`)).toThrow(/nest/i);
  });
});

describe("buildScenes: the reserved time axis", () => {
  const frames = (spec: string) => `
[[
  [[ [a][b] ]]
  [[ [c][d] ]]
]]${spec};`;

  it("renders only the first time slice, and says so", () => {
    const scene = sceneOf(frames("<(/>v_+/)>"));
    expect(
      Object.fromEntries(scene.blocks.map((b) => [b.pos.join(","), b.blockId]))
    ).toEqual({
      "0,0,0": "minecraft:a",
      "1,0,0": "minecraft:b",
    });
    expect(scene.notices).toHaveLength(1);
    expect(scene.notices?.[0]).toMatch(/time/i);
  });

  it("shows no notice for a single time slice", () => {
    expect(sceneOf(`[[ [a] ]]<(/>v_+/)>;`).notices).toBeUndefined();
  });

  it("shows no notice when the model has no time axis", () => {
    expect(sceneOf(frames("")).notices).toBeUndefined();
  });
});
