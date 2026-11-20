# Size baseline

Gzip sizes of the built entries, measured after whitespace minification (what `dist/` ships). Refresh with `npm run size -- --write`.

| Entry | File | Gzip (bytes) | Soft target (KB) |
|---|---|---|---|
| core | dist/index.js | 35672 | 35 |
| engine | src/engine/driver.ts | 19737 | 20 |
| avatar | dist/avatar.js | 12292 | 12 |
| motion | dist/motion.js | 1149 | 2 |
| base.css | dist/base.css | 2083 | none |
| theme.css | dist/theme.css | 1104 | none |

## Targets

Targets are soft: `npm run size` warns above them and never fails.

- **core** (35 KB): the whole public surface in one entry, which holds the engine (about 19 KB), the tour model, JSON parsing, persistence and the default presenter. The original 21 KB target was the engine alone.
- **engine** (20 KB): the forked driver bundled on its own, the figure to compare against upstream.
- **avatar** (12 KB): the speaker presenter, sprite player, pack validation and loaders, plus the presenter chunk it shares with core. Counted with that chunk because a page importing `virtualtour/avatar` loads both.
- **motion** (2 KB): a small optional entry.
- Bundlers tree-shake unused exports, so an app that imports only `createTour` ships less than the core figure.
