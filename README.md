# hggp image renderer

A web renderer for the 2D/3D Minecraft-build notation of **#>>+ (hggp) v2**. See `CLAUDE.md` for the full design brief and open questions.

## Stack

- [Vite](https://vite.dev/) — dev server and build
- [Bun](https://bun.sh/) — package manager and JS runtime
- [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) v4
- [shadcn/ui](https://ui.shadcn.com/) for panels/controls (Radix UI primitives)

## Commands

```bash
bun install      # install dependencies
bun run dev      # start the dev server
bun run build    # typecheck + production build
bun run lint     # oxlint
bun run preview  # preview a production build
```

## Adding shadcn/ui components

```bash
bunx shadcn@latest add <component>
```
