# AGENTS.md

Contract for coding agents working on this repository. If you are integrating VirtualTour into another site, you want [`llms.txt`](llms.txt) and the [`integrate-virtualtour` skill](.claude/skills/integrate-virtualtour/SKILL.md) instead.

## What this is

VirtualTour is a guided-tour library published to npm as three packages from one npm-workspaces monorepo:

| Package | Path | Notes |
|---|---|---|
| `virtual-site-tour` | `packages/core` | The library. Entry points `.`, `./avatar`, `./motion`, plus `base.css`, `theme.css`, `avatar.css`, the Thumbtack pack and JSON Schemas. |
| `virtual-site-tour-react` | `packages/react` | `TourProvider` and `useTour()`. Peer-depends on `virtual-site-tour` and `react >= 18`. |
| `virtual-site-tour-vue` | `packages/vue` | `TourProvider` and `useTour()`. Peer-depends on `virtual-site-tour` and `vue >= 3.3`. |

Live demo: https://quaz579.github.io/virtualtour/ (built from `demo/` by `.github/workflows/pages.yml` on every push to `main`).

## Layout

- `packages/core/src/engine/`: the positioning, overlay and popover engine forked from driver.js 1.12.1. Fork tracking lives in `UPSTREAM.md` and `NOTICE.md`; a fingerprint test (`test/fork-point.node.test.ts`) fails on any engine edit until regenerated.
- `packages/core/src/`: the tour model (`tour.ts`, `step.ts`, `types.ts`), JSON tours (`json/`), persistence (`persist/`), the avatar presenter (`avatar/`), motion helpers (`motion/`), and CSS (`styles/`).
- `packages/core/test/` (Vitest, `*.node.test.ts` and DOM tests) and `packages/core/e2e/` (Playwright, served from `demo/`).
- `packages/core/API-FREEZE.md`: every exported name. `test/api-freeze.node.test.ts` fails when exports change until you regenerate it with `UPDATE_API_FREEZE=1 npm test -- test/api-freeze.node.test.ts` (run in `packages/core`).
- `packages/core/STYLES.md`: the class, attribute and CSS-variable contract, checked against the shipped CSS by a test.
- `docs/`: VitePress site. Code samples live in `docs/snippets/**` and are pulled in with `<<< @/snippets/...`; `npm run typecheck` compiles them, so a broken sample fails CI.
- `demo/`: the e2e harness (`e2e.html`, `scenarios.ts`) and the Pages demo site (`demo/site`).
- `tools/`: prose lint, link check, release scripts, upstream cherry-pick helper.
- `llms.txt`, `.claude/skills/integrate-virtualtour/SKILL.md`: agent-facing docs. `packages/core` carries byte-identical copies that ship in the npm tarball; `test/release.node.test.ts` fails if they drift. After editing either root file, copy it over: `cp llms.txt packages/core/llms.txt && cp .claude/skills/integrate-virtualtour/SKILL.md packages/core/skills/integrate-virtualtour/SKILL.md`.

## Commands

Run from the repository root with Node 20.19 or later (CI uses Node 22). This is the order CI runs them in (`.github/workflows/ci.yml`):

```sh
npm ci
npm run lint:prose      # banned-word scan; there is no code linter
npm run typecheck       # strict tsc for all packages, e2e and docs snippets
npm run build           # builds core, then react, then vue (react and vue import core's dist)
npm test                # Vitest for all three packages; some tests need the build output
npm run docs:build      # VitePress build of docs/
npm run docs:links      # relative-link check for docs/** and README.md
npx playwright install chromium   # once per machine, from packages/core
VT_E2E_PORT=4211 npm run e2e -- --project=chromium   # from packages/core
```

- Build before testing: `npm test` and the e2e suite read `packages/*/dist`.
- `VT_E2E_PORT` (default 4173) moves the demo server so parallel runs do not collide.
- `npm run e2e` without `--project` runs chromium, firefox, webkit and edge (edge only when installed).
- `npm run size` prints gzip sizes; `npm run size -- --write` refreshes `SIZE.md`.
- Run the demo locally: `npm run dev --workspace virtualtour-demo`. Docs locally: `npm run dev --workspace virtualtour-docs`.

## Conventions

- Commits and PR titles are Conventional Commits with an optional scope and the PR number appended by the squash merge, e.g. `fix(demo): add an inline favicon so the Pages site logs no 404 (#78)`. Types in use: `feat`, `fix`, `perf`, `test`, `docs`, `ci`, `chore`.
- The commit type decides the release (below), so pick it deliberately: `docs:`, `chore:`, `test:` and `ci:` never publish.
- TypeScript strict mode, ESM only, no runtime dependencies in `virtual-site-tour`.
- Public API changes need: the type, a docs page or snippet update, `API-FREEZE.md` regenerated, and a test.
- Engine changes need the fork-point fingerprint regenerated: `UPDATE_FORK_POINT=1 npm test -- test/fork-point.node.test.ts` (in `packages/core`).
- No company or product names other than driver.js in the repository; `npm run lint:prose` enforces a word list kept outside git (`tools/README.md`).
- Keep `LICENSE` and `NOTICE.md` in the root and in `packages/core` in sync; a test checks them.

## Releases

Merging to `main` is the release. `.github/workflows/release.yml` runs CI, then `semantic-release` (`.releaserc.json`):

- `fix` releases a patch, `feat` a minor, `BREAKING CHANGE` or `!` a major. Other types release nothing.
- `tools/release-prepare.mjs` sets the same version in all three packages and the peer ranges; `tools/release-publish.mjs` publishes each package that is not already on npm.
- Publishing uses npm trusted publishing (GitHub Actions OIDC, `id-token: write`); there is no npm token.
- The bot commits `chore(release): X.Y.Z [skip ci]` with the bumped versions and `packages/core/CHANGELOG.md`, tags `vX.Y.Z` and creates the GitHub release.
- A failed publish after tagging is recovered with the `republish_tag` input of the Release workflow. Details in [`RELEASING.md`](RELEASING.md).

Never publish by hand, bump versions by hand or edit `CHANGELOG.md` by hand.
