# reference/

Local, read-only cache of source material this repo depends on. Nothing here is
edited upstream — see the "read only" rule in the project `CLAUDE.md`.

## hggp-blocks-materials.csv

Cached rows from the hggp dictionary spreadsheet
([link](https://docs.google.com/spreadsheets/d/1bOFxzszCgsRLJ1D6nsegEa_q76ZZUCHpV52XFe89Qws/edit?gid=1429835577#gid=1429835577&fvid=88508861)),
fetched 2026-09-13.

**Provenance note:** the CSV export endpoint (`/export?format=csv&gid=...`)
returns the full underlying tab (382 rows across every part of speech), not
the filtered "Blocks + Materials" view the URL's `fvid` points at — Google
Sheets filter views aren't reachable through that endpoint. The tab itself is
titled **"TMFDS Dictionary"**; "Blocks + Materials" is a filter view on top
of it, named exactly that (confirmed from the sheet's embedded page data).
Its filter formula, recovered from the same page data, is:

```
FIND("BLK", <POS column>) OR FIND("MAT", <POS column>)
```

i.e. any row whose `POS` column contains the literal substring `BLK` or
`MAT`, case-sensitive. `hggp-blocks-materials.csv` is that same filter
applied client-side to the fetched CSV — 60 rows, reproducing the view. If
the sheet changes, re-fetch with:

```
curl -sL "https://docs.google.com/spreadsheets/d/1bOFxzszCgsRLJ1D6nsegEa_q76ZZUCHpV52XFe89Qws/export?format=csv&gid=1429835577" \
  | python3 -c "import csv,sys; r=csv.reader(sys.stdin); rows=list(r); print(*(row for row in rows if 'BLK' in row[0] or 'MAT' in row[0]), sep='\n')"
```

## hggp-block-mapping.md / hggp-block-mapping.schema.json

Together these are the **non-spoiler half** of this repo's word → Minecraft
block table. The actual answers (which glyph resolves to which block) are
puzzle-spoiler content and are never tracked — see `CLAUDE.md` → "Word →
block mapping: spoiler policy". `hggp-block-mapping.md` records what's known
structurally (entity-vs-block rows, grammar rows, that resolution is a flat
lookup); `hggp-block-mapping.schema.json` documents the JSON shape the app's
import feature expects. The filled-in answers live only in
`private/hggp-block-mapping.answers.json`, which is gitignored — never
un-ignore it, and never copy its contents into a tracked file.
