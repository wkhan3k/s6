# Tile Clicker

A tiny idle game for CMPM 121: tap the tile, buy helpers, and watch the pile
grow. Built with TypeScript and Vite on the D1 starter.

## Play

- Click (or keyboard-activate) the big tile to earn one tile.
- Spend tiles in **Helpers** on Hand polish (more per click), Auto-tiler and
  Kiln (tiles per second).
- Progress saves to `localStorage`; **Reset save** starts over.
- Helpers keep earning while the tab is hidden, and up to 8 hours of production
  is credited when you come back.

## Run

```sh
deno task dev     # http://localhost:3000
deno task ci      # format check, lint, type check, build
deno task build   # production build in dist/
```

Pushing to `main` deploys `dist/` to GitHub Pages.

## Credits

Tooling adapted from the [CMPM 121 Fall 2026 S01 starter](https://github.com/ucsc-cmpm-121-f26/s01-starter/tree/8974888efb6537be82e8eb069db139ea885039da), which has no explicit repository license. No new license is assigned to that material. The D1 scaffold and original SVG were authored with OpenAI GPT-6 Astra assistance. Dependencies retain their respective licenses.
