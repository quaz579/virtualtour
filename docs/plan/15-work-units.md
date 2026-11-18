# 15. Work units (execution queue)

This file turns the 39 tasks in `04`–`10` into **47 work units** (WU-01 … WU-46 plus WU-46a), each sized for one coding
session (one Sonnet agent, about 1–2 hours of focused work, one PR). The task files stay the
source of truth for *what* to build; a unit says *which slice* of a task to do in one PR, what
it waits on, and how to prove it works. When a unit and its task file disagree, the task file
wins and the unit is corrected in the same PR (`00-README.md`, rule 8).

---

## 0. Project facts and assumptions

| Item | Value |
|---|---|
| Proposed repository name | **`virtualtour`** (from the working name in `00-README.md`; npm name and import path stay undecided, so the core package is `virtualtour` with `"private": true` until a name is chosen) |
| Tech stack | TypeScript 5.x (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vite library mode (ESM only, `.d.ts`), Vitest (`unit-node` + `unit-dom`/jsdom projects), Playwright (chromium, firefox, webkit, optional `msedge`), Node 20 LTS+, npm workspaces (`packages/*`, `docs`, `demo`), VitePress docs, React + Vue wrapper packages. Zero runtime dependencies. |
| License | **MIT** for the code, `LICENSE` with two copyright lines (`Copyright (c) Kamran Ahmed` and `Copyright (c) <year> VirtualTour contributors`), `NOTICE.md` recording the driver.js fork point (tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`). Thumbtack art is **CC0 1.0** in its own `LICENSE-ART.md` (`13-licensing.md` §1, §7). No third-party character art is ever committed. |
| Fork source | `github.com/nilbuild/driver.js` at tag `1.12.1`, cloned read-only next to the repo (`../driver.js-1.12.1`). |

### Open questions that would block starting, answered here (ASSUMED)

Every question in `12-risks-open-questions.md` §1 is either already decided by the owner or
has a plan default. None blocks M0. The items below are the ones a coding agent would
otherwise stop and ask about; each is **assumed** until the owner says otherwise.

| # | Question | Assumed answer |
|---|---|---|
| A1 | Repository name / hosting (§2 says out of scope) | Repo `virtualtour`; host and CI are not configured by any unit. Gates run locally with the commands below. |
| A2 | npm package name (undecided) | Core package named `virtualtour`, wrappers `virtualtour-react` / `virtualtour-vue`, all `"private": true`. Renaming later is a find-and-replace in `package.json` files and docs. |
| A3 | Package manager | npm (the plan's examples use it). Lockfile `package-lock.json` committed. |
| A4 | Q6 docs tool | VitePress (plan default). |
| A5 | Q7 React `<TourStep>` component | No; provider plus hook only (plan default). |
| A6 | Q8 avatar `point.<dir>` rule | Vector to target center (plan default). |
| A7 | Q9 browser versions | Pinned at 1.0 in `docs/guide/browser-support.md`, ES2020 target (plan default). |
| A8 | Banned-words list for the prose lint gate (`11-testing.md` §6.6, "maintainer-supplied") | WU-02 ships the lint script with the list in `tools/banned-words.txt`, seeded empty except for a comment; the owner fills it in. The gate is active from day one but trivially green until then. |
| A9 | Edge channel on test machines | Optional; the `edge` Playwright project skips loudly when `msedge` is absent. Only WU-46 (release readiness) requires one full four-engine run. |
| A10 | Lawyer review of the classic-pack docs page (V-17 checklist) | Not a blocker for any unit; WU-46 records it as an open release gate, not a coding task. |

---

## 1. Conventions for every unit

- All commands run from the repository root. WU-01/WU-02 create these root scripts, which
  delegate to the workspaces: `npm run build`, `npm run typecheck`, `npm test`
  (both Vitest projects), `npm run e2e` (Playwright), `npm run size`
  (`node packages/core/tools/size-report.mjs`), `npm run lint:prose`.
- Targeted runs: `npm test -- <path>` and `npm run e2e -- <spec> [--project=chromium]`.
  Paths below are relative to `packages/core/`.
- **Base gate (every unit, not repeated below):**
  `npm ci && npm run typecheck && npm test && npm run lint:prose && npm run size`
  plus, for any unit touching `src/engine/**`, `npm run e2e -- e2e/engine` and an updated
  `test/fixtures/fork-point.sha256`. Paste the size output into the PR.
- The Definition of done in `00-README.md` applies to every unit (strict TS, no runtime
  deps, SSR gate, TSDoc on public API, no company/product names, American English).
- **Milestone-closing units** (marked ★) run the full suite: `npm run e2e` on all projects.
- **Model**: `sonnet` unless marked `haiku`. Engine geometry units are the hardest
  Sonnet work; if one fails review twice, escalate it rather than retrying.
- **Parallel group** names a wave. Units in the same wave may run at the same time once
  their own `depends-on` are merged. Units flagged *file-conflict* edit the same engine
  file as a sibling and should merge one at a time (rebase the later one).

---

## 2. Queue at a glance

| Wave | Units (in queue order) |
|---|---|
| W0 | WU-01 |
| W1 | WU-02 |
| W2 | WU-03, WU-04 |
| W3 | WU-05 ★ |
| W4 | WU-06 (V-01), WU-07 (A-01) |
| W5 | WU-08 (V-02), WU-09 (A-03 Thumbtack), WU-10 (A-03 test pack) |
| W6 | WU-11 (V-03 model) |
| W7 | WU-12 (V-03 lifecycle) |
| W8 | WU-13 V-04, WU-14 V-05a, WU-15 F-04, WU-16 F-09, WU-17 F-12, WU-18 F-13, WU-19 F-14 |
| W9 | WU-20 V-05b, WU-21 F-05, WU-22 F-06, WU-23 F-11, WU-24 A-02, WU-25 V-10, WU-26 V-16 |
| W10 | WU-27 V-06 ★, WU-28 F-07, WU-29 F-10, WU-30 V-07, WU-31 V-13 React, WU-32 V-13 Vue |
| W11 | WU-33 F-08 |
| W12 | WU-34 V-08, WU-35 A-04 engine |
| W13 | WU-36 V-09 ★, WU-37 V-12 ★, WU-38 V-11, WU-39 A-04 presenter |
| W14 | WU-40 A-05 |
| W15 | WU-41 A-06, WU-42 A-07 |
| W16 | WU-43 A-08 ★ |
| W17 | WU-44 V-14a docs, WU-45 V-14b demo |
| W18 | WU-46a V-15 avatar docs |
| W19 | WU-46 V-17 ★ |

**First parallel wave with real fan-out:** after WU-05 merges, WU-06 and WU-07 run together;
after WU-12, seven units (WU-13 … WU-19) run together.

---

## 3. Units

### M0 — fork bootstrap

#### WU-01 Import driver.js and build it with Vite
- **Milestone / source:** M0 / F-01 (first half).
- **Depends on:** none. **Wave:** W0. **Model:** sonnet.
- **Touches:** `packages/core/src/engine/**` (byte copy, two renames only), `LICENSE`,
  `packages/core/LICENSE`, `NOTICE.md`, `UPSTREAM.md` (policy + empty log), root and core
  `package.json` (workspaces, `exports`, no `dependencies`), `packages/core/tsconfig.json`,
  `packages/core/vite.config.ts`, `src/styles/base.css` (import only), `src/index.ts`
  (placeholder `createTour`), empty `src/avatar/index.ts` and `src/motion/index.ts`,
  `packages/core/README.md`, root scripts `build`/`typecheck`.
- **Acceptance:**
  - First commit adds only the copied files (fork point is one SHA); hints/checklist files
    not copied; `driver(` → `createEngine(` and `[driver.js]` → `[virtualtour]` are the
    only engine edits besides the minimal strict-flag type fixes, each listed in the PR.
  - `LICENSE` has both copyright lines; `NOTICE.md` names tag and commit; no `dependencies` key.
  - `npm run build` emits `dist/index.js`, `index.dev.js`, `avatar.js`, `motion.js`,
    `*.d.ts`, `base.css`.
- **Verify:** `npm ci && npm run typecheck && npm run build && ls packages/core/dist`

#### WU-02 Test harnesses, demo fixture page, SSR/build/fork-point gates, size report
- **Milestone / source:** M0 / F-01 (second half) + `11-testing.md` §6 gates.
- **Depends on:** WU-01. **Wave:** W1. **Model:** sonnet.
- **Touches:** `packages/core/vitest.config.ts` (projects `unit-node`, `unit-dom`),
  `playwright.config.ts` (chromium, edge-optional, firefox, webkit; `webServer` on `demo/`),
  `demo/` (`index.html`, `main.ts`, `e2e.html`, `e2e.ts` ported from `e2e.astro`, `fixtures/`),
  `test/ssr.node.test.ts`, `test/build.node.test.ts`, `test/fork-point.node.test.ts`,
  `test/fixtures/fork-point.sha256`, `tools/size-report.mjs`, `SIZE.md`,
  `e2e/smoke.spec.ts`, `tools/lint-prose.mjs` + `tools/banned-words.txt` (A8), root scripts
  `test`/`e2e`/`size`/`lint:prose`.
- **Acceptance:** the F-01 "Tests/proof required" list passes; `dist/index.js` has no bare
  imports; size report prints a table (core ≈ 14 KB) and exits 0; edge project reports
  skipped when absent.
- **Verify:** `npx playwright install --with-deps && npm test && npm run e2e -- e2e/smoke.spec.ts && npm run size && npm run lint:prose`

#### WU-03 Port driver.js unit tests
- **Source:** M0 / F-02 (unit half). **Depends on:** WU-02. **Wave:** W2 (parallel with WU-04). **Model:** sonnet.
- **Touches:** `test/engine/**` (upstream `tests/**` minus hints, checklist,
  `core/public-surface.test.ts`), `test/engine/utils.ts`, snapshots, `test/engine/README.md`.
- **Acceptance:** 19 files (verify against the tree, record the count) pass under
  `unit-dom`; no assertion weakened; any skip has a written reason.
- **Verify:** `npm test -- test/engine`

#### WU-04 Port driver.js Playwright specs
- **Source:** M0 / F-02 (e2e half). **Depends on:** WU-02. **Wave:** W2. **Model:** sonnet.
- **Touches:** `e2e/engine/**` (22 specs), `e2e/engine/harness.ts`, `demo/e2e.ts` additions.
- **Acceptance:** all 22 specs green on chromium, firefox, webkit; flakes as `test.fixme`
  with a reason; suite wall time recorded in the PR.
- **Verify:** `npm run e2e -- e2e/engine`

#### WU-05 ★ Rename, data attributes, namespace option
- **Source:** M0 / F-03. **Depends on:** WU-03, WU-04. **Wave:** W3. **Model:** sonnet
  (largest M0 unit; it cannot be split without leaving the suite red between PRs).
- **Touches:** `src/engine/core/namespace.ts` (new), `types.ts`, `core/context.ts`, every
  engine file listed in F-03, `engine/styles/engine.css` (from `driver.css`), `src/styles/base.css`,
  all of `test/engine/**` and `e2e/engine/**` (string rename), `test/engine/namespace.test.ts`,
  `e2e/namespace.spec.ts`, `docs/guide/styling.md` placeholder, fork-point fixture.
- **Acceptance:** F-03 acceptance; `grep -r "driver-" packages/core/src` empty; whole ported suite green.
- **Verify:** `! grep -r "driver-" packages/core/src && npm test && npm run e2e`

### M1 — public API

#### WU-06 Config, deep merge, ids, emitter, compiler
- **Source:** M1 / V-01. **Depends on:** WU-05. **Wave:** W4. **Model:** sonnet.
- **Touches:** `src/config.ts`, `src/events.ts`, `src/compile.ts`, `src/internal.ts`, tests below.
- **Acceptance:** V-01 tests incl. one named test per row of `03-schemas.md` §1.4;
  `compile.ts`/`config.ts` use only `import type` from the engine.
- **Verify:** `npm test -- test/config.test.ts test/events.test.ts test/compile.node.test.ts`

#### WU-08 Engine seams for the public API
- **Source:** M1 / V-02. **Depends on:** WU-06. **Wave:** W5. **Model:** sonnet.
- **Touches:** engine `types.ts`, `interaction/events.ts`, `driver.ts`, `tour/highlight.ts`,
  `overlay/overlay.ts`, `tour/step.ts`, `popover/popover.ts`, `popover/position.ts`, `core/context.ts`.
- **Acceptance:** V-02 acceptance; ported suite green.
- **Verify:** `npm test -- test/engine/keys-split.test.ts test/engine/overlay-off.test.ts test/engine/per-step-stage.test.ts test/engine/presenter-seam.test.ts && npm run e2e -- e2e/engine`

#### WU-11 Tour model and registry (no engine wiring yet)
- **Source:** M1 / V-03 (part 1). **Depends on:** WU-08. **Wave:** W6. **Model:** sonnet.
- **Touches:** `src/tour.ts` (class shape, steps, `appendStep`/`dropStep`/`stepById` while idle),
  `src/step.ts`, `src/registry.ts`, `src/navigator.ts` (index selection + serialization
  skeleton), `src/presenter.ts` (`DialogPresenter` skeleton), `src/index.ts` exports,
  error classes, `test/tour-model.test.ts`, `test/registry.test.ts`.
- **Acceptance:** the `tour-model.test.ts` list from V-03 passes; `createTour` is the default
  export; registry tracks `current` and relays events; SSR gate still green.
- **Verify:** `npm test -- test/tour-model.test.ts test/registry.test.ts test/ssr.node.test.ts`

#### WU-12 Tour lifecycle, event ordering, exit prompt, invariants
- **Source:** M1 / V-03 (part 2). **Depends on:** WU-11. **Wave:** W7. **Model:** sonnet.
- **Touches:** `src/tour.ts` (start, forward/backward/goTo, exit, finish, hideCurrent,
  running add/remove, teardown, hook → event mapping), `test/lifecycle.test.ts`,
  `test/engine/invariants.test.ts`, `e2e/navigation.spec.ts`, `demo/fixtures/navigation.html`.
- **Acceptance:** every `01-architecture.md` §7.2 row is a test name and passes; only
  `src/tour.ts` imports a value from `engine/driver.ts` (grep test); 11 invariants pass.
- **Verify:** `npm test -- test/lifecycle.test.ts test/engine/invariants.test.ts && npm run e2e -- e2e/navigation.spec.ts`

#### WU-13 Eligibility loop
- **Source:** M1 / V-04. **Depends on:** WU-12. **Wave:** W8. **Model:** sonnet.
- **Touches:** `src/navigator.ts`, `src/dom/target.ts`, `src/advance/**`, tests below, fixtures.
- **Acceptance:** V-04 acceptance (shouldShow, waitFor, whenMissing, prepare, revealWith, auto-advance).
- **Verify:** `npm test -- test/navigator.test.ts test/dom/wait.test.ts test/advance.test.ts && npm run e2e -- e2e/eligibility.spec.ts e2e/auto-advance.spec.ts`

#### WU-14 Accessible name in the engine + content rendering and sanitizer
- **Source:** M1 / V-05 (part 1: engine `label`, `render/content.ts`, `render/parts.ts`, full
  `DialogPresenter` body/title, `sanitize`, `classes`, `meta`, close-button attribute guard).
- **Depends on:** WU-12. **Wave:** W8. **Model:** sonnet. *File-conflict:* `popover/popover.ts`
  with WU-35 later (sequential anyway).
- **Acceptance:** `aria-label`/`aria-labelledby` rules from V-05; placeholder texts empty;
  body types string / string[] / Element / function render; sanitizer runs before the engine
  sees HTML; attribute guard rejects `on*` and `style`.
- **Verify:** `npm test -- test/engine/aria-label.test.ts test/render/content.test.ts test/render/parts.test.ts`

#### WU-20 Buttons, counter, step instance API
- **Source:** M1 / V-05 (part 2: `render/buttons.ts`, `counter`, `labels`, `focus`,
  `TourStep.configure`, `element`, `isShown`, `Tour.progressInfo`).
- **Depends on:** WU-14. **Wave:** W9. **Model:** sonnet.
- **Touches:** `src/render/buttons.ts`, `src/step.ts`, `src/tour.ts`, `test/render/buttons.test.ts`,
  `test/step-api.test.ts`, `test/counter.test.ts`, `e2e/content.spec.ts`, `e2e/configure.spec.ts`,
  `demo/fixtures/content.html`.
- **Acceptance:** remaining V-05 acceptance; counter counts skipped steps (owner decision).
- **Verify:** `npm test -- test/render test/step-api.test.ts test/counter.test.ts && npm run e2e -- e2e/content.spec.ts e2e/configure.spec.ts`

#### WU-27 ★ Action steps in the public API
- **Source:** M1 / V-06. **Depends on:** WU-20, WU-13. **Wave:** W10. **Model:** sonnet.
- **Acceptance:** V-06 acceptance (`instruction`, `advanceDelay`, `autoAdvance.strict`,
  `advance()`, `nudge()`, `completed` events).
- **Verify:** `npm test -- test/action-steps.test.ts && npm run e2e` (milestone close: full suite)

### M2 — engine features

All M2 units touch `src/engine/**`: update the fork-point fixture, run `npm run e2e -- e2e/engine`,
and delete the matching "ignored until" note in `03-schemas.md` §1.4.

| Unit | Source | Depends on | Wave | Touches (main files) | Verify (beyond base gate) |
|---|---|---|---|---|---|
| WU-15 Scroll-container clipping | F-04 | WU-12 | W8 | `overlay/overlay.ts`, `overlay/stage.ts`, new clip helper | `npm test -- test/engine/overlay-clip.test.ts && npm run e2e -- e2e/engine/overlay-clip.spec.ts` |
| WU-16 Nested scroll following, scroll lock | F-09 | WU-12 | W8 | `interaction/events.ts`, `tour/highlight.ts` | `npm test -- test/engine/scroll-capture.test.ts && npm run e2e -- e2e/engine/scroll.spec.ts` |
| WU-17 Per-corner radius | F-12 | WU-12 | W8 (*file-conflict* `overlay/stage.ts` with WU-15) | `overlay/stage.ts`, `types.ts` | `npm test -- test/engine/stage-radius.test.ts && npm run e2e -- e2e/engine/stage-radius.spec.ts` |
| WU-18 Mount containers | F-13 | WU-12 | W8 | `driver.ts`, `overlay/overlay.ts`, `popover/popover.ts` | `npm test -- test/engine/mount-in.test.ts && npm run e2e -- e2e/engine/mount-in.spec.ts` |
| WU-19 Reduced motion in the engine | F-14 | WU-12 | W8 | `overlay/overlay.ts` tween, `tour/highlight.ts` | `npm test -- test/engine/reduced-motion.test.ts && npm run e2e -- e2e/engine/animation.spec.ts` |
| WU-21 Extra cut-outs, deduped | F-05 | WU-15 | W9 | `tour/allowed.ts`, `overlay/stage.ts` | `npm test -- test/engine/allowed-cutout.test.ts && npm run e2e -- e2e/engine/allowed-cutout.spec.ts e2e/engine/allowed-elements.spec.ts` |
| WU-22 Boundary, padding, `side:'over'` | F-06 | WU-15 | W9 | `popover/position.ts` | `npm test -- test/engine/boundary.test.ts && npm run e2e -- e2e/engine/popover-boundary.spec.ts` |
| WU-23 Reveal options and custom handler order | F-11 | WU-13 | W9 | `tour/highlight.ts`, `tour/step.ts` | `npm test -- test/engine/scroll-into-view.test.ts && npm run e2e -- e2e/engine/reveal.spec.ts` |
| WU-28 Flip/shift switches, `placement:'auto'` | F-07 | WU-22 | W10 | `popover/position.ts` | `npm test -- test/engine/placement.test.ts && npm run e2e -- e2e/engine/placement.spec.ts` |
| WU-29 `absolute` strategy | F-10 | WU-22, WU-18 | W10 (*file-conflict* `position.ts` with WU-28: merge WU-28 first) | `popover/position.ts`, `engine.css` | `npm test -- test/engine/strategy.test.ts && npm run e2e -- e2e/engine/strategy.spec.ts` |
| WU-33 Cross offset, RTL, arrow off/min inset | F-08 | WU-28, WU-29 | W11 | `popover/position.ts`, `core/env.ts` | `npm test -- test/engine/rtl.test.ts test/engine/arrow.test.ts && npm run e2e -- e2e/engine/rtl.spec.ts e2e/engine/arrow.spec.ts` |

Acceptance for each row: the source task's "Acceptance criteria" and listed tests, all three
browsers, ported suite green. Model: **sonnet** for all; WU-22/WU-28/WU-33 are the
geometry-heavy ones.

### M3 — presentation

#### WU-30 Spotlight mapping, state classes, click blocking
- **Source:** V-07. **Depends on:** WU-13, WU-15, WU-21, WU-17, WU-19. **Wave:** W10. **Model:** sonnet.
- **Verify:** `npm test -- test/spotlight/options.test.ts && npm run e2e -- e2e/overlay.spec.ts`

#### WU-34 Stylesheets, theme, dark mode, missing-stylesheet warning
- **Source:** V-08. **Depends on:** WU-20, WU-33, WU-29. **Wave:** W12. **Model:** sonnet.
- **Touches:** `src/styles/base.css`, `src/styles/theme.css`, dev-only warning, `test/styles.test.ts`, `e2e/theme.spec.ts`.
- **Verify:** `npm test -- test/styles.test.ts && npm run e2e -- e2e/theme.spec.ts && npm run build && ls packages/core/dist/theme.css`

#### WU-36 ★ Accessibility audit (dialog mode)
- **Source:** V-09. **Depends on:** WU-30, WU-34, WU-27. **Wave:** W13. **Model:** sonnet.
- **Acceptance:** zero accessibility-engine violations on representative steps in 3 browsers; focus trap/return; keyboard.
- **Verify:** `npm test -- test/a11y.test.ts && npm run e2e` (full)

### MA — avatar

#### WU-07 Avatar pack types, validation, preload
- **Source:** A-01. **Depends on:** WU-05. **Wave:** W4 (parallel with WU-06). **Model:** sonnet.
- **Verify:** `npm test -- test/avatar/pack.test.ts test/ssr.node.test.ts`

#### WU-09 Thumbtack character and pack build
- **Source:** A-03 (Thumbtack half). **Depends on:** WU-07. **Wave:** W5. **Model:** sonnet.
- **Touches:** `src/avatar/thumbtack/**` (`frames.mjs`, `svg/**`, `sheet.png`, `pack.json`,
  `LICENSE-ART.md`), `tools/build-thumbtack-pack.mjs`, `test/avatar/thumbtack.test.ts`, `packages/core/ART.md`.
- **Acceptance:** A-03 acceptance (CC0 license field, sheet < 150 KB, every §9.1 animation,
  `point-*` lean ≥ 15°, not a paperclip per `13-licensing.md` §4); contact sheet PNG in PR.
- **Verify:** `node packages/core/tools/build-thumbtack-pack.mjs && npm test -- test/avatar/thumbtack.test.ts`

#### WU-10 Synthetic test pack generator
- **Source:** A-03 (test-pack half). **Depends on:** WU-07. **Wave:** W5. **Model:** haiku (mechanical generator script).
- **Touches:** `tools/make-test-pack.mjs`, `e2e/fixtures/test-pack/` (sheet, `pack.json`, `classic-a.json`, `classic-b.json`), a small existence/JSON test.
- **Verify:** `node packages/core/tools/make-test-pack.mjs && npm test -- test/avatar/test-pack.node.test.ts`

#### WU-24 Sprite player and frame scheduler
- **Source:** A-02. **Depends on:** WU-07, WU-19. **Wave:** W9. **Model:** sonnet.
- **Verify:** `npm test -- test/dom/frame.test.ts test/avatar/player.test.ts && npm run e2e -- e2e/avatar-player.spec.ts`

#### WU-35 Speaker layout in the engine
- **Source:** A-04 (engine half: `createPopover(layout)`, bubble/avatarSlot, arrow measured on the bubble, `RepositionInfo.bubbleRect`).
- **Depends on:** WU-14, WU-33. **Wave:** W12. **Model:** sonnet.
- **Acceptance:** `layout:'dialog'` output unchanged (ported snapshot); speaker structure per `02-avatar.md` §4.1; arrow offset math per side.
- **Verify:** `npm test -- test/engine/speaker-layout.test.ts && npm run e2e -- e2e/engine/speaker-arrow.spec.ts e2e/engine`

#### WU-39 `SpeakerPresenter` and `avatar.css`
- **Source:** A-04 (public half). **Depends on:** WU-35, WU-24, WU-20, WU-30. **Wave:** W13. **Model:** sonnet.
- **Touches:** `src/avatar/speaker.ts`, `src/styles/avatar.css`, `test/avatar/speaker.test.ts`, `e2e/avatar-layout.spec.ts`, `demo/fixtures/avatar-layout.html`.
- **Acceptance:** A-04 acceptance (dialog role named by title, avatar `aria-hidden`, core size delta < 500 B); screenshots in PR.
- **Verify:** `npm test -- test/avatar/speaker.test.ts && npm run e2e -- e2e/avatar-layout.spec.ts`

#### WU-40 `withAvatar()` and per-step animation selection
- **Source:** A-05. **Depends on:** WU-39, WU-27. **Wave:** W14. **Model:** sonnet.
- **Verify:** `npm test -- test/avatar/selection.test.ts && npm run e2e -- e2e/avatar-steps.spec.ts`

#### WU-41 Idle loop and reduced motion end to end
- **Source:** A-06. **Depends on:** WU-40. **Wave:** W15. **Model:** sonnet.
- **Verify:** `npm test -- test/avatar/idle.test.ts && npm run e2e -- e2e/avatar-motion.spec.ts`

#### WU-42 Pack loaders (v1, classic formats, Thumbtack)
- **Source:** A-07. **Depends on:** WU-09, WU-10, WU-40. **Wave:** W15. **Model:** sonnet.
- **Acceptance:** A-07 acceptance incl. art tripwire on repo and tarball.
- **Verify:** `npm test -- test/avatar/classic.test.ts test/avatar/loaders.test.ts && npm run e2e -- e2e/avatar-classic.spec.ts`

#### WU-43 ★ Avatar styles, size, fallback hardening, avatar a11y
- **Source:** A-08. **Depends on:** WU-41, WU-42, WU-36. **Wave:** W16. **Model:** sonnet.
- **Verify:** `npm test -- test/avatar/fallback.test.ts && npm run e2e && npm run size` (full; avatar entry ≤ ~6 KB, warn-only)

### M4 — extras

#### WU-25 Persistence hooks
- **Source:** V-10. **Depends on:** WU-13. **Wave:** W9. **Model:** sonnet.
- **Verify:** `npm test -- test/persist.test.ts && npm run e2e -- e2e/persist.spec.ts`

#### WU-38 JSON tours and schema files
- **Source:** V-11. **Depends on:** WU-27, WU-07, WU-28, WU-33, WU-29, WU-17, WU-18. **Wave:** W13. **Model:** sonnet.
- **Verify:** `npm test -- test/json/tour-json.test.ts test/schemas.test.ts`

#### WU-37 ★ Motion add-on
- **Source:** V-12. **Depends on:** WU-20, WU-34. **Wave:** W13. **Model:** sonnet.
- **Verify:** `npm test -- test/motion && npm run e2e && npm run size` (full; motion ≤ ~2 KB, warn-only)

### M5 — polish

#### WU-31 React wrapper
- **Source:** V-13 (React half). **Depends on:** WU-20. **Wave:** W10. **Model:** sonnet.
- **Touches:** `packages/react/**`, React tests (`*.test.tsx`), React part of `e2e/wrappers.spec.ts` + demo fixture.
- **Acceptance:** provider + hook only (A5); strict-mode double effect does not start two tours; peers only.
- **Verify:** `npm -w packages/react test && npm run typecheck && npm run e2e -- e2e/wrappers.spec.ts --grep react`

#### WU-32 Vue wrapper
- **Source:** V-13 (Vue half). **Depends on:** WU-20. **Wave:** W10. **Model:** sonnet.
- **Verify:** `npm -w packages/vue test && npm run typecheck && npm run e2e -- e2e/wrappers.spec.ts --grep vue`

#### WU-26 Upstream tracking tooling and first review
- **Source:** V-16. **Depends on:** WU-05 and any one merged engine unit (WU-15). **Wave:** W9. **Model:** sonnet.
- **Note:** the "first review" log entry is redone in WU-46 so the per-file table covers all M2 changes.
- **Verify:** `npm test -- test/upstream-apply.node.test.ts`

#### WU-44 Docs site, guides, cookbook, migration page
- **Source:** V-14 (docs half). **Depends on:** WU-36, WU-25, WU-38, WU-37, WU-31, WU-32, WU-43, every M2 unit. **Wave:** W17. **Model:** sonnet (prose-heavy; may need two sessions — if so, split guides vs cookbook+migration and keep one PR each).
- **Touches:** `docs/**` incl. `.vitepress/config.ts`, `docs/snippets/**`, `docs/examples/tours/*.json`, migration-table test, link check script.
- **Acceptance:** V-14 docs criteria; snippets compile; JSON examples validate; migration names exist on both sides; no vendor names.
- **Verify:** `npm run typecheck && npm test -- test/docs && npm -w docs run build && npm run lint:prose && node tools/check-links.mjs`

#### WU-45 Consolidated demo and full e2e run
- **Source:** V-14 (demo half). **Depends on:** same as WU-44. **Wave:** W17 (parallel with WU-44). **Model:** sonnet.
- **Touches:** `demo/` scenario picker, `demo/fixtures/*.html` consolidated, `docs/demo.md`.
- **Acceptance:** every e2e spec references an existing fixture; full suite green on all engines; light/dark screenshot gallery in PR.
- **Verify:** `npm run e2e` (all projects) `&& npm -w demo run build`

#### WU-46a Avatar docs, make-your-own pack, classic-pack page, licensing page
- **Source:** V-15. **Depends on:** WU-43, WU-44. **Wave:** W18. **Model:** sonnet.
- **Acceptance:** classic-pack page carries the `13-licensing.md` §5.3 warning block; art tripwire green; no Microsoft art anywhere.
- **Verify:** `npm -w docs run build && npm run lint:prose && npm test -- test/art-tripwire`

#### WU-46 ★ Size tuning, API freeze, release readiness
- **Source:** V-17. **Depends on:** WU-46a, WU-26. **Wave:** W19. **Model:** sonnet.
- **Acceptance:** V-17 checklist; `e2e/perf.spec.ts` tripwire; one full four-engine run (edge installed); refreshed upstream review in `UPSTREAM.md`; lawyer review listed as an open release gate (A10).
- **Verify:** `npm ci && npm run build && npm run typecheck && npm test && npm run e2e && npm run size && npm run lint:prose`

---

## 4. Split and merge record

| Task | Decision | Why |
|---|---|---|
| F-01 | split → WU-01, WU-02 | import/build and the harness/gates are each a full session |
| F-02 | split → WU-03, WU-04 | ~7 100 unit lines and ~7 500 spec lines; independent harnesses |
| F-03 | kept whole (WU-05) | a partial rename leaves the suite red |
| V-03 | split → WU-11, WU-12 | model/registry is testable without the engine wiring |
| V-05 | split → WU-14, WU-20 | content + accessible name vs buttons/counter/step API |
| A-03 | split → WU-09, WU-10 | Thumbtack pipeline vs a mechanical test-pack generator |
| A-04 | split → WU-35, WU-39 | engine layout and arrow vs public presenter and CSS |
| V-13 | split → WU-31, WU-32 | React and Vue are independent packages |
| V-14 | split → WU-44, WU-45 | docs site vs demo consolidation and full e2e |
| everything else | 1 task = 1 unit | already PR-sized |

No task was trivial enough to merge; the smallest (F-12, V-10, V-16) still carry their own
engine or e2e tests. Unit IDs are not contiguous in queue order because they were numbered
by wave assignment; the wave table in §2 is the execution order.
