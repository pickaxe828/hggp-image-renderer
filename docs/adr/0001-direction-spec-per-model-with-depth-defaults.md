---
status: accepted
---

# Direction spec is a per-model modifier with depth-based defaults

A model's axis directions come from a `<(/…/)>` direction spec placed after its closing `]]`. It applies to that one model and nothing leaks. A model without one uses `>v` (2D) or `>v+` (3D). This replaces the earlier "row order vs. Y" working assumption and answers how a model's slice plane is declared: it is whichever two world axes the row-axis and column-axis carry.

## Considered options

- **Module-level spec that leaks like glyph definitions.** Rejected: direction describes one model's layout, not a substitution table. Leaking would make a model's meaning depend on what came before it.
- **Document-wide spec.** Rejected for the same reason, and it cannot express a document with models in different planes.
- **Keep the working assumption, with the plane inferred from nesting.** Rejected: it was provisional, and it needed two opposite-direction flips that were easy to get silently wrong.

## Consequences

- The column glyph points at the low end of its axis (`v`: the top row is highest), while the row glyph points at the high end. This is deliberate: it makes the 2D default equal the old "top row is highest Y" rule.
- The 3D default (XY slices stacked along +Z) is not the old 3D behaviour (XZ slices stacked along +Y). Existing 3D tests and fixtures change.
- Export must remember whether a spec was present, so the IR keeps "absent" and "explicit" as different states.
- `/…/` looks like an element reference, so the spec needs its own lexing path.
