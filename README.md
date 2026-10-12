# hggp image renderer

> ## ⚠️ Spoiler alert
>
> The #>>+ (hggp) conlang is usually shared as a **decoding puzzle**, and this
> project sits right next to the answers. Read on only if you're happy to
> have some of it spoiled:
>
> - This README and the docs in this repo describe how the build notation is
>   structured (glyphs, modules, extents, slice layout).
> - The hggp dictionary, its exports, and the **word → Minecraft block table**
>   (which word renders as which block) are deliberately **not** in this repo
>   or its git history. The only hggp-specific code here is the notation
>   parser.
> - The block table is loaded at runtime from a JSON file you import yourself.
>   Local copies of dictionary material live in a gitignored `private/` folder.
>   Without a mapping, the app still runs and shows placeholder blocks.

A web app for rendering image-esque expressions written in **#>>+ (hggp) v2**, a
constructed language made for the ConSMP Minecraft server. hggp can describe
2D and 3D Minecraft builds in text; this project parses that notation and draws
the build as a 3D voxel view.

This repo is the renderer, not the language spec.

## Status

Early development. What exists today:

- Notation parser, intermediate representation, and serializer (round-trip
  tested: notation → IR → notation)
- Word → block mapping: schema, validation, import UI, and `localStorage`
  persistence

Still to build: the 3D view, camera controls, texture loading, and URL
sharing. See [`CLAUDE.md`](./CLAUDE.md) for the full design brief, planned
stages, and open questions.

## Dependencies

You need two things installed globally:

- [Bun](https://bun.sh/) — package manager and script runner
- [Node.js](https://nodejs.org/) — used by Vite and Vitest under the hood
  (a current LTS release is fine)

Everything else is installed from `package.json`. The main pieces:

| Area               | Packages                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Build / dev server | [Vite](https://vite.dev/), TypeScript                                                                                                       |
| UI                 | [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/) v4, [shadcn/ui](https://ui.shadcn.com/) (Radix UI, `lucide-react`) |
| Lint               | [oxlint](https://oxc.rs/docs/guide/usage/linter)                                                                                            |
| Tests              | [Vitest](https://vitest.dev/), Testing Library, jsdom                                                                                       |

The planned 3D layer,
[block-model-renderer](https://github.com/ewanhowell5195/block-model-renderer)
(Three.js-based, MPL-2.0), is not installed yet.

## Getting started

```bash
# 1. Install dependencies
bun install

# 2. Start the dev server (Vite prints the local URL, usually http://localhost:5173)
bun run dev
```

Other commands:

```bash
bun run build       # typecheck + production build into dist/
bun run preview     # serve the production build locally
bun run lint        # oxlint
bun run test        # run tests once (Vitest)
bun run test:watch  # run tests in watch mode
```

To add a shadcn/ui component:

```bash
bunx shadcn@latest add <component>
```

## Loading a block mapping

On first run the app has no word → block mapping. Use **Import mapping** in
the app to load a JSON file; it is saved to `localStorage` so you don't need
to re-import on every visit.

The expected shape is defined in
[`reference/hggp-block-mapping.schema.json`](./reference/hggp-block-mapping.schema.json)
(structure only, no answers).

If you keep a local copy of your own mapping or dictionary exports in the repo,
put them under `private/`. That folder is gitignored; don't remove it from
`.gitignore` and don't paste its contents into commits, issues, or PRs.

## Textures

Minecraft block textures belong to Mojang and can't be committed to this repo
or bundled into a deployed site. How textures are loaded is still undecided;
see `CLAUDE.md` for the options.

## Notation at a glance

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

- `---` blocks are **modules**: tables that substitute a two-character glyph
  with a block (`[...]`) or another language element.
- `[[ ... ]]` is a **2D block model**, one glyph per cell.
- `<X,Y,Z>` after a block is an **extent**, the block tiled across that region.

The notation is only partly specified here; the open questions (such as how a
model's slice plane is declared) are tracked in `CLAUDE.md`.
