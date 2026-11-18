# 04. Milestone 0: fork bootstrap

Outcome: driver.js 1.12.1 lives in this repository as `packages/core/src/engine/`, builds
with Vite under strict TypeScript, passes its own ported unit and browser suites against the
fork's harnesses, carries the two-notice license and the fork-point record, and uses
VirtualTour's class names, data attributes, and namespace. No public API exists yet beyond a
placeholder; the engine factory is importable by tests only.

Tasks: F-01 → F-02 → F-03, strictly sequential. Every later milestone depends on F-03.

---

## F-01 Import the fork, build, gates, license files

**Goal.** Copy driver.js at tag `1.12.1` into the workspace as the engine, drop what v1 does
not use (hints, checklists, the Astro apps, tsdown, turbo), build it with Vite, and add the
SSR gate and the size report.

**PRD requirements covered.** D-1, D-3, D-6 (zero runtime dependencies), D-7 (test matrix
scaffold), NF-size (report), NF-ssr (gate), NF-tests (harness).

**Files in the fork.**
- `packages/core/src/engine/**`: byte-for-byte copies of `packages/driver/src/**` from the
  upstream clone at commit `0163642dc532417ea401684bd26690e2f3283d63`, **except**
  `hints.ts`, `checklist.ts`, `styles/hints.css`, `styles/checklist.css` (not copied).
  `driver.ts` keeps its content; only `export function driver(` becomes
  `export function createEngine(` and the `[driver.js]` console prefix becomes
  `[virtualtour]`. No other edits in this task.
- `LICENSE` (repository root and `packages/core/LICENSE`): the MIT text with two copyright
  lines, `Copyright (c) Kamran Ahmed` and `Copyright (c) <year> VirtualTour contributors` (holder
  decided by maintainer, 2026-11-13), per `13-licensing.md` §1.
- `NOTICE.md`: fork provenance (upstream URL `https://github.com/nilbuild/driver.js`,
  tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`, date 2026-11-11, the
  original notice verbatim, the list of files not carried over).
- `UPSTREAM.md`: the policy from `01-architecture.md` §12 and an empty review log table.
- `package.json` (workspaces: `packages/*`, `docs`, `demo`), `packages/core/package.json`
  (`type: module`, `exports` as in `01-architecture.md` §1, no `dependencies`, `sideEffects`
  list of CSS files, `files`).
- `packages/core/vite.config.ts`: `build.lib` entries `index`, `avatar`, `motion`;
  `formats: ['es']`; for the `avatar`/`motion` entries the core entry is `external`;
  `define: { __DEV__ }` producing `index.js` and `index.dev.js`; CSS emitted as `base.css`,
  `theme.css`, `avatar.css`; `.d.ts`.
- `packages/core/src/styles/base.css`: for now `@import "../engine/styles/driver.css";`
  (the engine CSS already imports `popover.css`). F-03 restructures.
- `packages/core/tsconfig.json` (strict flags from `01-architecture.md` §1). Fix every
  engine type error the stricter flags surface (`noUncheckedIndexedAccess` is the usual
  one) with the smallest local change; list each in the PR.
- `packages/core/vitest.config.ts`: projects `unit-node` (`environment: node`,
  `test/**/*.node.test.ts`), `unit-dom` (`environment: jsdom`, everything else under
  `test/**`).
- `packages/core/playwright.config.ts`: projects `chromium`, `edge` (`channel: 'msedge'`,
  skipped when missing), `firefox`, `webkit`; `webServer` runs `demo/`.
- `packages/core/tools/size-report.mjs`: builds, gzips each entry, prints a table with the
  delta against `SIZE.md`, prints `warning:` lines above the soft targets (21 KB core,
  6 KB avatar, 2 KB motion), exits 0 always.
- `packages/core/test/ssr.node.test.ts`: imports `../src/index.ts`, `../src/engine/driver.ts`,
  `../src/avatar/index.ts`, `../src/motion/index.ts` with `globalThis.window` and
  `document` deleted; asserts no throw.
- `demo/` Vite app: `index.html`, `main.ts`, `e2e.html` + `e2e.ts` (the bare fixture page,
  ported from upstream `apps/playground/src/pages/e2e.astro`: same element ids, exposes
  `window.__engine = { createEngine }` and `window.log = []`, sets `data-ready`), `fixtures/`
  (empty).
- `packages/core/src/index.ts` exporting a placeholder `createTour`.
- `packages/core/README.md`: commands only.

**Public API added.** None (placeholder only).

**Tests/proof required.**
- `npm run build` emits `dist/index.js`, `dist/index.dev.js`, `dist/avatar.js`,
  `dist/motion.js`, `dist/*.d.ts`, `dist/base.css`; `dist/index.js` contains no `import`
  of any bare specifier (nothing external) — asserted by `test/build.node.test.ts`.
- `npm test` runs both Vitest projects; `ssr.node.test.ts` passes.
- `npm run e2e` runs `e2e/smoke.spec.ts` (the demo e2e page loads, `window.__engine` is
  present, `createEngine({ steps: [...] }).drive()` shows a `.driver-popover`) in chromium,
  firefox, webkit (and edge when present).
- `node tools/size-report.mjs` prints sizes; the core entry reports about 14 KB.
- A unit test asserts `src/engine/**` matches the upstream tree: `test/fork-point.node.test.ts`
  compares SHA-256 of every file under `src/engine/` against `test/fixtures/fork-point.sha256`
  (generated once from the committed `src/engine/` at the end of F-01, which includes the
  two renames and the strict-flag type fixes), so later drift is caught.
  F-03 and later tasks update the fixture when they change a file and say so in the PR.

**Acceptance criteria.**
- A fresh clone with Node 20 can run build, unit, e2e, and the size report with the
  documented commands.
- `packages/core/package.json` has no `dependencies` key.
- `LICENSE` carries both copyright lines; `NOTICE.md` names the tag and commit.
- `git log` shows one commit that only adds the copied files (the import) and separate
  commits for everything else, so the fork point is one SHA in our history too.

**Depends on.** none.

---

## F-02 Port driver.js's unit tests and Playwright specs

**Goal.** Bring the upstream test suites into the fork so the engine is as well covered on
day one as it was upstream, running on our harnesses (Vitest projects, the Vite demo's
e2e page, four-engine Playwright matrix).

**PRD requirements covered.** NF-tests.

**Files in the fork.**
- `packages/core/test/engine/**`: copies of upstream `packages/driver/tests/**` minus
  `hints/`, `checklist/`, and `core/public-surface.test.ts` (it asserts the npm package
  shape of driver.js, which no longer applies). `tests/utils.ts` → `test/engine/utils.ts`
  importing `createEngine` from `../../src/engine/driver`. Snapshot files
  (`__snapshots__/*.snap`) copied as is. The `vitest.config.ts` alias for `driver.js` is
  dropped (it existed for the checklist).
- `packages/core/e2e/engine/**`: copies of upstream `apps/playground/e2e/*.spec.ts` minus
  `hints.spec.ts` and `checklist.spec.ts`; `harness.ts` → `e2e/engine/harness.ts` with
  `window.driverjs.driver` → `window.__engine.createEngine`, `openFixture` going to
  `/e2e.html`. Specs that build tours inline keep their bodies.
- `demo/e2e.ts`: anything the ported specs need that `e2e.astro` provided (the element
  set is already there from F-01).
- `packages/core/test/engine/README.md`: one paragraph: these files derive from driver.js's
  suite at the fork point, how they map, and that F-03 renamed class strings.

**Public API added.** None.

**Tests/proof required.**
- Every ported unit file passes under the `unit-dom` project. Expected count: 19 files
  (22 upstream minus hints, checklist, public-surface) — verify against the tree and list
  the final count in the PR.
- Every ported spec passes on chromium, firefox, webkit (and edge when present). Expected
  count: 22 spec files (24 minus hints and checklist). Known upstream flake notes (if any
  appear) are recorded per spec with `test.fixme` and a reason, not deleted.
- CI time for the ported suites is recorded in the PR (a baseline for later tasks).

**Acceptance criteria.** No test is skipped without a written reason; no assertion is
weakened to make a port pass (a diff review item). The ported suites are the first thing a
later engine task runs.

**Depends on.** F-01.

---

## F-03 Rename, data attributes, and the namespace option

**Goal.** Replace every `driver-` name with VirtualTour's, split the engine's markers into
fixed mechanism data attributes and namespaced styling classes (`01-architecture.md` §5),
add the `namespace` engine option, and route every class/attribute string through one
table.

**PRD requirements covered.** T-10, ST-4, ST-1 (functional stylesheet keyed on data
attributes).

**Files in the fork.**
- `src/engine/core/namespace.ts` (new): `export function names(ns = 'vt')` returning a
  frozen object with every prefixed class and data-attribute name, plus the fixed
  mechanism attribute names and popover class names. `Context` gains `names` built once
  from `config.namespace` in `createContext`.
- `src/engine/types.ts`: `Config.namespace?: string`.
- `src/engine/core/context.ts`: default `namespace: 'vt'`; validation (`/^[a-zA-Z][\w-]*$/`,
  throws otherwise).
- Every engine file that builds a class string (`driver.ts:387,468`,
  `tour/highlight.ts:245,251,260-261,268,274,277,282,285-290`, `tour/allowed.ts` (`ALLOWED_CLASS`),
  `core/utils.ts:21-22`, `overlay/overlay.ts:109,157`, `popover/popover.ts` (every
  `driver-popover*` string, `createElement` calls, ids), `popover/position.ts:161-162,250,257,266`,
  `popover/live-region.ts:9`, `tour/step.ts:301`, `tour/nudge.ts:3`, `interaction/*.ts`
  selectors): replaced with `ctx.names.<key>` or, where no context is available
  (`position.ts`, `popover.ts` helpers), with the fixed popover names from `names()`.
- Mechanism markers become data attributes: `<body>` gets `data-vt-active` (plus
  `data-vt-dim` when the overlay is on, V-02) instead of `driver-active`; the target gets
  `data-vt-target` / `data-vt-blocked` / `data-vt-raised`; extras `data-vt-extra`; the parent
  `data-vt-target-parent` / `data-vt-lock-scroll`; the overlay SVG `data-vt-overlay`; the
  dialog layer `data-vt-layer`. The `guardClasses` observer (`tour/highlight.ts:227-240`)
  guards both the data attribute and the namespaced class.
- `src/engine/styles/engine.css` (renamed from `driver.css`, `@import` of `popover.css`
  removed): every rule rewritten to the data attributes (`driver.css:3-39,51-66`); the
  popover-internal rules (`driver.css:68-219`) use the fixed `vt-popover-*` classes.
- `src/styles/base.css`: `@import "../engine/styles/engine.css";` followed by the content of
  `popover.css` with `driver-` → `vt-` (the file `engine/styles/popover.css` is deleted; its
  content now lives in `base.css` because it is visual, not functional).
- Ported tests and specs (`test/engine/**`, `packages/core/e2e/engine/**`): `driver-` strings →
  `vt-`; `.driver-active` body checks → `[data-vt-active]`; element-state checks →
  the data attributes. Done by a reviewed search-and-replace plus hand fixes.
- `test/fixtures/fork-point.sha256` regenerated; `test/engine/README.md` updated.
- `docs/` placeholder page `styling.md` listing the class contract (full docs in V-14).

**Public API added.** Engine `Config.namespace` (reaches the public API as
`TourConfig.namespace` in V-01).

**Tests/proof required.**
- Unit `test/engine/namespace.test.ts`: `names('vt')` and `names('tour2')` produce the
  expected strings; invalid namespace throws; two engines with different namespaces on one
  page (sequentially) leave no stale classes from the other namespace on `<body>` or the
  target; a grep test asserts no `"driver-` string literal remains under `src/` and no
  class name is built by concatenation outside `namespace.ts` (regex on `classList.add(`
  arguments that contain a quote and a hyphen).
- Unit: the pointer-events rule in `engine.css` keys on `[data-vt-active][data-vt-dim]`
  (parse the stylesheet and assert the selector text).
- e2e `packages/core/e2e/namespace.spec.ts` (3 browsers): a tour with `namespace: 'abc'` puts
  `abc-target` on the target and `data-abc-step` on the popover, the overlay still blocks
  clicks outside the cut-out (mechanism attributes unaffected), and a stylesheet rule on
  `.abc-target` applies while `.vt-target` matches nothing.
- The whole ported suite stays green after the rename.

**Acceptance criteria.** `grep -r "driver-" src/` returns nothing; `grep -r "driver" src/`
matches only `NOTICE`-style comments in `engine/README` (none in code except the file name
`driver.ts`). `base.css` plus `engine.css` are each under their upstream size + 10 %.

**Depends on.** F-02.
