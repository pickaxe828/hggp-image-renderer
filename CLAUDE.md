# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The repository is **empty** — no source, no git history. The renderer has not been started, but the toolchain is decided: **Vite** for dev server/build, **Bun** as package manager and JS runtime. Do not assume build, lint, or test commands exist yet; add this section's actual commands (`bun install`, `bun run dev`, etc.) once the Vite scaffold lands.

## What this project is

A renderer for the 2D/3D Minecraft-build notation of **#>>+ (hggp) v2**, a constructed language originally made for the ConSMP Minecraft server. The language draws on Minecraft vocabulary and on programming-language syntax conventions. This repo consumes hggp build notation and produces images; it is not the language spec itself.

## Design requirements

Target is a **web app**, 3D, built around a voxel view of hggp build notation.

**Stage 1**
- 3D rendering of the parsed model, showing Minecraft blocks with textures
- Interactive camera: pan, orbit, zoom
- Import and export of hggp notation
- In-view panel showing the grammar/source for the current model
- Model state compressed into the URL so a view is shareable by link

**Stage 2**
- Editing the model directly in 3D

**Soft requirement (all stages):** run smoothly on mobile browsers, not just desktop. Not a hard blocker, but weigh it when picking rendering libraries/approaches — e.g. a mid/low-end Android phone (tested reference point: Galaxy A35 5G, Chrome) should stay usable.

### Requirements that constrain the architecture now

These are stage-1 decisions that stage 2 cannot undo cheaply:

- **Export must regenerate hggp notation from the in-memory model, not echo the imported text.** 3D editing (stage 2) means the model becomes the source of truth and the notation has to be re-emitted from it — including inventing modules and glyphs for the blocks in use. Build the IR so it can round-trip *notation → IR → notation* from day one, and test that round-trip early. Retrofitting this after a render-only IR is a rewrite.
- **Put the source text in the URL, not the voxel grid.** The notation is already a compression format — glyph substitution plus extents encode large regions in a few characters — so serializing expanded voxels throws that away and blows the budget. Compress the notation (e.g. DEFLATE + base64url) and keep it in the **fragment** (`#…`), which is never sent to a server and avoids URL-length limits that apply to query strings. Expect link-sharing surfaces to truncate long URLs regardless; treat very large models as export-to-file, not shareable-by-link, rather than silently producing a broken link.
- **The grammar panel and the 3D view are two views of one IR.** Decide early whether the panel is read-only or an editable source-of-truth; if editable, it needs live re-parse and the same IR round-trip as above. Read-only in stage 1 is a reasonable cut, but do not build it as a separate code path that stage 2 has to replace.

### Rendering library — decided

Use **[block-model-renderer](https://github.com/ewanhowell5195/block-model-renderer)** (MPL-2.0, Three.js-based) as the 3D rendering layer, over deepslate (MIT, raw WebGL). Reasoning:

- Its [live demo](https://block-model-renderer.ewanhowell.com/) already does interactive, multi-block scenes — camera orbit via drag, zoom via pinch/scroll, whole builds "merged into a handful of draw calls" — which is close to stage 1's voxel-view requirement out of the box. deepslate's `Structure`/`StructureRenderer` API is a good match for our IR's block grid, but it ships no camera/orbit controls or multi-block interactive demo — that layer would have to be built from scratch on top of it.
- Confirmed to run smoothly on a mid/low-end Android phone (Galaxy A35 5G, Chrome), which matters given the mobile soft requirement above.
- Its demo fetches Minecraft assets **live from Mojang's servers at runtime** as one of its supported modes. That's a third option beyond the two below and has its own ToS considerations (distinct from "user loads their own resource pack, nothing redistributed by us") — confirm which asset-loading mode this repo actually uses before shipping, don't inherit the demo's default silently.

Revisit if block-model-renderer's blockstate/model resolution turns out too thin for a block this renderer needs (e.g. a tricky multipart or tinted block).

### Word → block mapping: spoiler policy — decided

This project is normally exposed to the public as a conlang-decoding puzzle.
The word → Minecraft block table (which hggp glyph renders as which block)
**is the answer to that puzzle** and must never be bundled into the app or
committed to this repo — either would let anyone read the answers straight
out of devtools/git history instead of solving it.

- The mapping is **user-imported JSON**, loaded through an in-app "Import
  mapping" action, and **persisted to `localStorage`** so it survives
  reloads without re-importing every session.
- With no mapping imported, the app must degrade gracefully — render
  unresolved/placeholder blocks rather than failing — so a default public
  deployment never leaks answers just by existing.
- Schema for that JSON lives at `reference/hggp-block-mapping.schema.json`
  (tracked — it's structure only, no answers). A filled-in copy for local
  dev lives at `private/hggp-block-mapping.answers.json`, **gitignored** —
  never remove it from `.gitignore`, never paste its contents into a tracked
  file, commit message, or PR description.
- **User-confirmed:** keep that file at the repo root under `private/`,
  gitignored, even though git isn't initialized yet — protect it from the
  first commit onward rather than adding the ignore rule later, regardless
  of whether this repo ends up public or private.
- Resolution at runtime is a **flat exact-string lookup** (bracket contents
  → block ID) — no morphology parsing of the word itself. This is both the
  scope-discipline-correct choice (the renderer doesn't need to understand
  hggp's word-formation rules, only the finished words that appear in real
  notation) and what keeps any compositional/morphological pattern out of
  app source, where it would double as a spoiler.
- General notation *parsing* (tokenizing glyph rows, module substitution,
  extents, grammar) is not spoiler content and is fine to hardcode — only
  the finished word → block *answers* are sensitive.

See `reference/hggp-block-mapping.md` for what's tracked (non-spoiler
structure) vs. what only exists in the gitignored private file.

### Texture sourcing — unresolved, has a licensing dimension

Minecraft block textures are Mojang's assets and are not redistributable, so they cannot be committed to this repo or bundled into a deployed site. Workable options: have the user load their own resource pack / client jar locally in-browser (nothing is redistributed), fetch assets live from Mojang's servers at runtime (see rendering-library note above — has its own licensing angle, don't assume it's equivalent to the local-load option), or ship an openly-licensed texture set. Decide before building the texture pipeline — it changes the asset loading path, not just the art.

## Scope discipline

**Implement only the parsing the renderer actually needs — nothing more.** hggp is a full language; this repo is not a general hggp front end. Do not build out word morphology, parts of speech, or dictionary tooling on speculation. If a construct isn't needed to put pixels on screen, leave it unparsed.

## External reference

Dictionary, **blocks-only view** — the sheet that matters for this repo:
https://docs.google.com/spreadsheets/d/1bOFxzszCgsRLJ1D6nsegEa_q76ZZUCHpV52XFe89Qws/edit?gid=1429835577#gid=1429835577&fvid=88508861

Use that view rather than the full dictionary; it is filtered to blocks, which is nearly all this renderer needs.

**The user does not own this language or its docs. NEVER edit, comment on, or otherwise write to that spreadsheet or any other hggp doc — read only.**

## The build notation

```
---
.. ::= [$_]<8,8>;
██ ::= [!<$]<8,8>;
@@ ::= /@/;
---

[[
  ......@@....
  ████████████
]]:=/C/;
```

A document interleaves **modules** (the `---`-delimited legends) and **2D block models** (the `[[ ]]` grids).

### Operators

- **`::=` is *definition*** — introduces something new into the temporary context. This is what a module does for each glyph.
- **`:=` is *identify*** — explains something that already exists in the language. So `]]:=/C/` does not name a new model; it states that the model depicts the existing element `/C/`.
- **`==` is *equivalence*** — states that a sized word and an explicit model are the same thing (see Extents below).

Keep all three distinct in the AST. They are not spellings of one thing.

### Blocks and words

`[...]` encloses a Minecraft block. It is **not** a part-of-speech tag — `[%]` is itself the hggp *word* for "Minecraft block" (the noun naming that part of speech, the way 動詞 is the word for "verb"), with `%` reading as a placeholder. So `[$_]`, `[@0]`, `[!<$]` are blocks; `[%]` is the word "block".

Words seen: `$_`, `$..`, `$##`, `$~~`, `$#w`, `$xw`, `$~w`, `$#w~`, `$#_`, `!<$`, `@0`. Do not infer meaning from their shape — look them up.

**Word → Minecraft block resolution is this repo's own responsibility.** The mapping lives here; it is not part of the language. Keep it in one table, separate from the parser — and see "Word → block mapping: spoiler policy" below for where that table actually lives (not in app source).

### Extents

A `<...>` suffix on a word is an **extent**: the word tiled to fill that region. The dimension count sets the rank, and `==` spells the equivalence out:

```
[@0]<3>     == [[ [@0][@0][@0] ]];;

[@0]<3,3>   == [[
                 [@0][@0][@0]
                 [@0][@0][@0]
                 [@0][@0][@0]
               ]];

[@0]<3,3,3> == [[
                 [[ ...3x3... ]]
                 [[ ...3x3... ]]
                 [[ ...3x3... ]]
               ]];
```

So `<X>` is a row, `<X,Y>` a slice, `<X,Y,Z>` a stack of `Z` slices — **the third axis is expressed by nesting `[[ ]]` inside `[[ ]]`**. Extents are per-word; never hardcode `8,8` globally.

**Axis order is `<X,Y,Z>`, each ascending (+X, +Y, +Z).**

This also explains module right-hand sides: `[$_]<8,8>` substitutes the block `$_` tiled across an 8-by-8 region of the slice.

### Cells

A model's cells come in two forms, and a parser must accept both:

- **bracketed words** written inline — `[@0][@0][@0]`
- **two-character glyphs** defined by a module — `......@@....`

The glyph form is shorthand; substitution expands it into the bracketed form. Glyphs are exactly **two characters**, any characters, ASCII or not (`..`, `░░`, `▒▒`, `~~`, `@@`, `██`, `▓▓`, `~w`, `##` all appear). The fixed width is what makes glyph rows tokenizable.

Glyph characters and word characters are **separate namespaces** — the glyph `##` and the word `$##` are unrelated, as are the glyph `~~` and word `$~~`. Never resolve one through the other.

### Modules

Delimited by `---`; each statement is `<glyph> ::= <definition>;`.

A module is a **string-substitution table**: left-hand side is the pattern, right-hand side the replacement. Render by substituting, not by interpreting glyphs in place. Right-hand sides are either a sized word (`[$_]<8,8>`) or an existing language element (`/@/`).

**Module definitions leak across 2D block models.** They are not block-scoped: a model may use glyphs from an earlier module, and a later module may rebind a glyph (`░░` goes from `[$..]` to `[$#w]` in the reference example). Carry a running substitution table, with later definitions shadowing earlier ones.

### 2D block models

Delimited by `[[` and `]]`, followed by `:=/<name>/`. Leading indentation is layout, not content. Row width is constant within a model; height varies freely between models (11, 11, and 8 rows in the reference example). Text rows read visually top-to-bottom. How that maps onto world axes depends on the slice plane — see below.

### Row order vs. Y — WORKING ASSUMPTION

Not confirmed against the spec. Implement it behind a single, clearly-named function so it can be flipped in one place when the real rule lands.

- **Slice contains Y (XY or YZ plane):** text rows run **-Y**. The first text row is the highest Y; the last is the bottom of the build. Row index increases as Y decreases.
- **Slice is XZ (no Y inside the slice):** within-slice rows are Z, and the **stack of slices implicitly advances +Y**. Slice index 0 is the lowest Y.

So Y is descending within a Y-bearing slice, but ascending across a stack of XZ slices. These pull in opposite directions; do not unify them into one flip. Getting either wrong renders builds upside down with no error and a plausible-looking image — the likeliest silent bug in the pipeline.

## Implementation constraints

- **Tokenize glyph rows by fixed 2-char cells, never by regex over glyph characters.** Glyphs are multi-byte (`░`, `▒`, `█`, `▓`) — iterate Unicode scalar values / code points, not bytes or UTF-16 units, or `~w`-style mixed-width rows will desynchronize.
- **Substitution can chain.** A glyph may resolve to another language element (`@@ ::= /@/`), so resolution is a graph walk, not a flat lookup. Guard against cycles, and expect forward references — `/@/` is used in the reference example without a visible definition.
- Statement terminators vary in the source seen so far (`;`, `;;`, and absent at end of input). Be permissive; don't hang correctness on them.

## Open questions

Ask the user rather than inventing answers:

- How a model's **slice plane** (XY / YZ / XZ) is actually determined — the working assumption above branches on it, but nothing seen so far shows how the notation declares it. This is the blocker for correct 3D output.
- Whether the -Y / +Y split above is the intended rule; it is a provisional decision by the user, not spec.
