# hggp ⇔ Minecraft block mapping

**Spoiler policy — read first:** this project is normally exposed to the
public as a conlang-decoding puzzle. Which hggp word resolves to which
Minecraft block is the answer to that puzzle, so it must never land in a
tracked file, app source, or shipped bundle — that would let anyone read the
answers out of devtools instead of solving it. See `CLAUDE.md` → "Word →
block mapping: spoiler policy" for the runtime design (user-imported JSON,
persisted to `localStorage`, never bundled).

This file is the non-spoiler half: what's *structurally* known about the
mapping, kept separate from the actual answers.

## Where the real answers live

`private/hggp-block-mapping.answers.json` (gitignored — see `.gitignore`,
never commit it). Shape defined by `hggp-block-mapping.schema.json` in this
same directory.

Status: the words already named in `CLAUDE.md`'s "Blocks and words" section
(`$_`, `$..`, `$##`, `$~~`, `$#w`, `$xw`, `$~w`, `$#w~`, `$#_`, `!<$`) plus
the two place references (`/C/`, `/@/`) are **confirmed** and live in that
file. `@0` from the Extents section is a generic placeholder used to
illustrate the `<...>` syntax, not a real dictionary word — no entry needed.

## What's confirmed structurally (not spoiler — no block names below)

- Word resolution is a **flat exact-string lookup**: the parser looks up the
  bracket contents verbatim against the imported map. It does not parse or
  reconstruct any internal morphology of the word at runtime — deliberately,
  per the scope-discipline rule in `CLAUDE.md` (don't build morphology
  tooling the renderer doesn't need). Whatever compositional pattern the
  language actually uses stays outside the codebase entirely.
- Material-category classifier words (the `%, MAT` / `%, BLK` rows in the
  [dictionary's Blocks + Materials view](./hggp-blocks-materials.csv)) are
  templates with a placeholder slot, not complete words on their own — a
  complete word fills that slot with a further glyph. This confirms *why* a
  flat lookup table (rather than a compositional resolver) is the right
  shape for this repo: we only need the finished words that actually appear
  in real build notation, not the general rule for producing them.

## Non-block rows from the dictionary view (still useful, not spoiler)

- **`BLK` rows for Boat, Minecart (+ variants), Armor Stand, Item Frame,
  Painting, Text/Block Display, Interaction, End Crystal, Falling Block**
  are Minecraft **entities**, not placeable voxel-grid blocks. Recommend
  leaving these unparsed for now (scope discipline) — flag if a real build
  needs one.
- **`BLK-M` rows** (slab, stairs, wall, plate, crossed vertical planes,
  button-sized) are shape *modifiers* that combine with a material, not
  standalone blocks — e.g. "slab" isn't a block by itself. If/when these
  show up in real notation, they'll need their own resolution step separate
  from the flat word lookup above; not designed yet.
- **Grammar rows** (`[%]` block-word, `[%%]` block classifier, `[$%$]` /
  `[$%$,$%$]` / `[$%$,$%$,$%$]` "block at (x[,y[,z]])") are syntax, not
  vocabulary. They belong in the parser's grammar, not this table.
- **Atomic/subatomic particle rows** (proton, neutron, electron, quarks,
  photon, …) have no Minecraft block correspondence found. Out of scope.

## Open (only if/when new words show up in real notation)

Everything above resolves the words currently named in `CLAUDE.md`. If a
real build introduces a bracket word not yet in the private JSON, add it
there directly (with the user) — don't guess a block ID and don't write the
resolved value into any tracked file.
