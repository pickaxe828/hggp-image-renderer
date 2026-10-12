# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The Vite + Bun + React + Tailwind + shadcn/ui scaffold has landed (TypeScript, `src/` app shell, `@/*` import alias, no renderer logic yet — that's still to build). Commands:

```bash
bun install      # install dependencies
bun run dev      # start the dev server
bun run build    # typecheck + production build
bun run lint     # oxlint
bun run preview  # preview a production build
```

No test runner is set up yet; add one when there's non-trivial logic to test (the notation parser is the first candidate).

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

- **Export must regenerate hggp notation from the in-memory model, not echo the imported text.** 3D editing (stage 2) means the model becomes the source of truth and the notation has to be re-emitted from it — including inventing modules and glyphs for the blocks in use. Build the IR so it can round-trip _notation → IR → notation_ from day one, and test that round-trip early. Retrofitting this after a render-only IR is a rewrite.
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
- General notation _parsing_ (tokenizing glyph rows, module substitution,
  extents, grammar) is not spoiler content and is fine to hardcode — only
  the finished word → block _answers_ are sensitive.

**The same rule covers the dictionary sheet itself, its CSV exports, and any
notes derived from them** (including the sheet's structure, tab/filter names,
and refetch commands). The sheet's sharing settings are public; that does not
make it publishable here. Keep all of it under gitignored `private/` — never
in a tracked file or in git history. Only the notation _parser_ and the
mapping _schema_ (`reference/hggp-block-mapping.schema.json`) are tracked.
Local notes live in `private/hggp-block-mapping.md` and
`private/dictionary-source.md`.

### Texture sourcing — unresolved, has a licensing dimension

Minecraft block textures are Mojang's assets and are not redistributable, so they cannot be committed to this repo or bundled into a deployed site. Workable options: have the user load their own resource pack / client jar locally in-browser (nothing is redistributed), fetch assets live from Mojang's servers at runtime (see rendering-library note above — has its own licensing angle, don't assume it's equivalent to the local-load option), or ship an openly-licensed texture set. Decide before building the texture pipeline — it changes the asset loading path, not just the art.

## Scope discipline

**Implement only the parsing the renderer actually needs — nothing more.** hggp is a full language; this repo is not a general hggp front end. Do not build out word morphology, parts of speech, or dictionary tooling on speculation. If a construct isn't needed to put pixels on screen, leave it unparsed.

## External reference

Dictionary, **blocks-only view** — the sheet that matters for this repo. Its
URL and a cached CSV are kept out of the repo: see
`private/dictionary-source.md` (local only, gitignored).

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

- **`::=` is _definition_** — introduces something new into the temporary context. This is what a module does for each glyph.
- **`:=` is _identify_** — explains something that already exists in the language. So `]]:=/C/` does not name a new model; it states that the model depicts the existing element `/C/`.
- **`==` is _equivalence_** — states that a sized word and an explicit model are the same thing (see Extents below).

Keep all three distinct in the AST. They are not spellings of one thing.

### Blocks and words

`[...]` encloses a Minecraft block. It is **not** a part-of-speech tag — `[%]` is itself the hggp _word_ for "Minecraft block" (the noun naming that part of speech, the way 動詞 is the word for "verb"), with `%` reading as a placeholder. So `[$_]`, `[@0]`, `[!<$]` are blocks; `[%]` is the word "block".

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

Delimited by `[[` and `]]`, followed by `:=/<name>/`. Leading indentation is layout, not content. Row width is constant within a model; height varies freely between models (11, 11, and 8 rows in the reference example). Text rows read visually top-to-bottom. How that maps onto world axes is set by the model's **direction spec** — see below.

### Direction spec

A model may carry a **direction spec**: a `<…>` modifier that maps **world axes** (X, Y, Z, T) to signed **text axes** (row-axis, column-axis, slice-axis). Decided in ADR 0001; terms are defined in `CONTEXT.md`.

```
[[ … ]]<(/>v/)>:=/C/;     2D default, written out
[[ … ]]</>v+/>:=/C/;      3D default, parentheses omitted
```

- **Placement.** Directly after the closing `]]`, before `:=`. Also valid on the model on the right of `==`. A 3D model carries it on its outermost `]]` only. It modifies that one model: nothing leaks to later models, and nothing is inherited. (Unlike module glyph definitions, which do leak.)
- **Shape.** `<` `(`? `/` entries `/` `)`? `>`. The parentheses are optional. The entries sit between the slashes.
- **Entries are positional by world axis: X, Y, Z, T.** Each entry is one glyph. Trailing entries may be left out, and a left-out entry means `_`. A trailing `_` is therefore redundant (`>v+_` ≡ `>v+`).
- **Glyphs.**
  - `>` row-axis, value rises to the right (leftmost cell is lowest). `<` falls to the right.
  - `v` column-axis, value **falls** going down (the top row is highest). `^` rises going down.
  - `+` slice-axis, value rises with nesting order. `-` falls.
  - `_` the world axis is unused: size 1, coordinate 0.
  - The row glyph points at the high end of its axis; the column glyph points at the **low** end. This asymmetry is deliberate — it is what makes the 2D default match the old "top row is highest Y" behaviour. Do not "fix" it.
- **Defaults when absent.** The default is chosen by the model's nesting depth. 2D: `>v` (X to the right, top row is highest Y). 3D: `>v+` (XY slices stacked along +Z). A short spec does **not** borrow entries from the default: `<(/>/)>` is X only, every row at Y=0.
- **The slice plane comes from the spec**: it is whichever two world axes the row-axis and column-axis carry. Nothing else declares it. For example, `<(/_v>/)>` is a YZ slice (X unused, Y falls downward, Z rises to the right).
- **Errors, not guesses.** Report a clear message for: one text axis assigned to two world axes; a text axis the model really uses (several rows, several slices) that no world axis carries; nesting deeper than 2 levels (no text axis exists for depth 3). These are accepted: a slice-axis assignment on a 2D model, and an unused column-axis on a one-row model.
- **Extents stay in world-axis order `<X,Y,Z>`.** The spec decides how an extent's footprint lands on the page. With X mapped to the column-axis, `[w]<3,2>` is 3 rows tall. Placement must convert footprints through the spec; it must never assume X is the horizontal span.
- **T (time) is reserved.** Parse it and keep it in the IR so export round-trips it. Render slice 0 only, and show a notice if the model has more than one time slice.
- **World axes are Minecraft's**: X east, Y up, Z south. No relabelling or mirroring in the renderer; all axis choice lives in the spec.
- **Export.** The IR remembers whether a spec was present. Re-emit it only if it was, in short form (no parentheses, trailing `_` dropped). Never add one to a model that had none, and never drop an explicit one, even if it equals the default.
- **Lexing.** `/…/` is also the shape of an element reference, and a raw `/>v+/` looks like one. The spec needs its own lexing path, entered from a `<` that directly follows `]]`.

The old "Row order vs. Y — WORKING ASSUMPTION" is superseded. Its 2D case equals the new 2D default. Its 3D case (XZ slices stacked along +Y) does **not** equal the new 3D default; existing 3D tests and fixtures must change.

## Implementation constraints

- **Tokenize glyph rows by fixed 2-char cells, never by regex over glyph characters.** Glyphs are multi-byte (`░`, `▒`, `█`, `▓`) — iterate Unicode scalar values / code points, not bytes or UTF-16 units, or `~w`-style mixed-width rows will desynchronize.
- **Substitution can chain.** A glyph may resolve to another language element (`@@ ::= /@/`), so resolution is a graph walk, not a flat lookup. Guard against cycles, and expect forward references — `/@/` is used in the reference example without a visible definition.
- Statement terminators vary in the source seen so far (`;`, `;;`, and absent at end of input). Be permissive; don't hang correctness on them.

## Open questions

Ask the user rather than inventing answers. None are open on axis direction: the slice plane and the row/Y rules are settled by the direction spec (see above and ADR 0001). Add new questions here as they come up.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
