# 10. Milestone 5: polish and v1.0 readiness

Outcome: official React and Vue wrappers, a docs site with a live demo (including the
avatar guide, the migration page for driver.js users, and the "Loading a classic paperclip
avatar pack" page), the upstream-tracking tooling with its first recorded review, the API
freeze, and a release-readiness checklist. Publishing, hosting, and release automation are
out of scope.

Tasks: V-13 through V-17. V-13 is independent; V-14 needs everything else for accurate
docs; V-15 needs V-14 and A-08; V-16 is independent of V-14; V-17 is last.

---

## V-13 Framework wrappers: React and Vue

**Goal.** Thin wrapper packages: a React provider plus hook, and a Vue provider component
plus composable, each exposing a tour with reactive `isRunning` / `currentStep`.

**PRD requirements covered.** D-5.

**Files in the fork.** `packages/react/` (`package.json` with `react` and the core
package as peer dependencies, `src/index.tsx`, `vite.config.ts`, `test/*.test.tsx`),
`packages/vue/` (`package.json` with `vue` and the core package as peer dependencies,
`src/index.ts`, `vite.config.ts`, `test/*.test.ts`), `packages/core/e2e/wrappers.spec.ts`,
`demo/fixtures/react.html` and `react.tsx`, `demo/fixtures/vue.html` and `vue.tsx`.

**Public API added.** The packages are `virtual-site-tour-react` and `virtual-site-tour-vue`.
```tsx
// react: packages/react/src/index.tsx
<TourProvider config={TourConfig} autoStart?: boolean>{children}</TourProvider>
function useTour(): { tour: Tour; isRunning: boolean; currentStep: TourStep | null;
  start(): Promise<void>; forward(): Promise<void>; backward(): Promise<void>; exit(): Promise<boolean>; finish(): void }
// vue: packages/vue/src/index.ts
const TourProvider: component with props { config: TourConfig (required), autoStart?: boolean } and a default slot
function useTour(): { tour: Tour; isRunning: Readonly<Ref<boolean>>; currentStep: Readonly<Ref<TourStep | null>>;
  start(): Promise<void>; forward(): Promise<void>; backward(): Promise<void>; exit(): Promise<boolean>; finish(): void }
```
There is no Vue plugin and no `provideTour`: the Vue wrapper is a provider component that
calls `provide` itself, and `useTour()` injects its value (it throws outside a provider).
Both packages also export the `UseTourResult` type, and React exports `TourProviderProps`.

Implementation: the React provider creates the tour once in `useState`'s initializer,
subscribes with `useSyncExternalStore` to `started`, `step-shown`, `finished`, `exited`,
`deactivated`, and exits a running tour without a prompt on unmount; strict-mode double
effects must not start the tour twice (guard on `isRunning()`). The config object is not
watched for deep changes (documented; pass a new `key`). SSR: the tour is created during the
first render, which is safe on the server, and starts only in an effect. Vue: the tour is
created in `setup`, subscriptions are added in `onMounted` and removed in `onBeforeUnmount`,
and the tour exits on unmount of the provider; no DOM access in setup.

**Tests/proof required.**
- Unit: hook/ref values update on events; unmount exits a running tour; `autoStart` starts
  in an effect, once under strict mode; `renderToString` does not throw for both.
- e2e (3 browsers): the React and Vue fixture pages start a tour from a button, show the
  current step id from framework state, and navigate with hook calls.

**Acceptance criteria.** Neither package has `dependencies`; peers are `react >= 18` /
`vue >= 3.3` plus the core package.

**Depends on.** V-05.

---

## V-14 Docs site, cookbook, migration from driver.js, and the consolidated demo

**Goal.** A static docs site (VitePress suggested) with every PRD-required document in
plain language, a page that explains the fork plainly, a migration page for driver.js
users, and the demo app that doubles as the e2e fixture host and the live demo.

**PRD requirements covered.** NF-docs, S-2 (unsanitized HTML warning), A-9 (ordering
note), ST-4 (class names), section 3.15 (custom counter), AD-2 (programmatic advance), PRD
1.2 (body scroll locking is an app concern: `dim.pageScroll` maps to the engine's
`allowScroll`), NF-security (sanitizer hook), NF-tests (fixtures).

**Files in the fork.** `docs/` (`index.md`, `guide/getting-started.md`,
`guide/how-it-works.md` (the fork: what came from driver.js, what changed, the fork point,
the license, how we track upstream), `guide/steps-and-targets.md`,
`guide/positioning.md` (every `position` option with the boundary, flip/shift, auto,
RTL, strategy rules), `guide/overlay.md` (clipping, extras, per-corner radius, scroll
lock, `dim:false`), `guide/events-and-lifecycle.md` (the §7.2 table),
`guide/action-steps.md`, `guide/keyboard-and-focus.md`, `guide/persistence.md`,
`guide/json-tours.md`, `guide/styling.md` (class table from V-08 + variables + namespace),
`guide/containers.md` (`mountIn`, `dimMountIn`, the no-shadow-root rule),
`guide/accessibility.md`, `guide/framework-wrappers.md`, `api/` (generated from TSDoc or
hand-written), `cookbook/custom-counter.md`, `cookbook/advancing-programmatically.md`,
`cookbook/scroll-lock.md`, `cookbook/sanitizing-html.md`, `cookbook/multiple-tours.md`
(two namespaces on one page), `migration/from-driverjs.md` (the three tables from
`01-architecture.md` §4), `examples/tours/*.json`), `docs/.vitepress/config.ts`, `demo/`
(scenario picker, `fixtures/*.html` consolidated, `main.ts`), `docs/demo.md`.

**Public API added.** None.

**Tests/proof required.**
- Every code sample in `docs/guide/**`, `docs/cookbook/**`, and `docs/migration/**` is a
  real file under `docs/snippets/` imported into the page, compiled by `tsc --noEmit`.
- JSON examples validate against the schema (V-11's test includes `docs/examples/tours/`).
- Link check script passes.
- A unit test asserts every `driver.js` option name listed in the migration table's left
  column exists in the upstream `types.ts` at the fork point (so the table is complete and
  spelled right), and every right-column name exists in `src/index.ts` exports or
  `TourConfig`/`StepConfig` keys.
- The full e2e suite passes against the consolidated demo on all four engines; a screenshot
  gallery (one per scenario, light and dark) is attached to the PR.

**Acceptance criteria.** A new developer can go from install to a two-step tour by
following `getting-started.md` without reading anything else (one teammate does this and
records it in the PR). The docs name driver.js, the fork point, and its license on the
"how it works" page. No vendor, company, or product names other than driver.js anywhere in
the docs. Every e2e spec references a fixture that exists in `demo/`.

**Depends on.** V-09, V-10, V-11, V-12, V-13, A-08, every F task.

---

## V-15 Docs: avatar guide, make-your-own pack, "Loading a classic paperclip avatar pack" (not included), licensing page

**Goal.** Document the avatar system, how to draw a pack, how an integrator can load the
classic paperclip art on their own responsibility without the project shipping or linking
to the files, and the project's license story (code MIT with two copyright holders,
Thumbtack art CC0).

**PRD requirements covered.** AV-9, AV-12, `13-licensing.md` §5 (page plan), §6 (loader
rules), §7 (license files).

**Files in the fork.** `docs/avatar/index.md` (what it is, `withAvatar`,
`thumbtackPack`, per-step animations, idle, reduced motion, accessibility, how the speaker
layout is built by the engine), `docs/avatar/thumbtack.md` (the character, its license,
contact sheet image), `docs/avatar/make-a-pack.md` (sheet layout, `pack.json` fields with
the schema link, roles, tips, the `tools/build-thumbtack-pack.mjs` approach),
`docs/avatar/classic-packs.md` (exact outline in `13-licensing.md` §5.1),
`docs/licensing.md` (code MIT with both notices and the fork point; Thumbtack art CC0
1.0, no credit required; third-party art statement).

**Public API added.** None.

**Tests/proof required.**
- Snippets compile (same mechanism as V-14).
- A unit test asserts `docs/` contains no PNG/GIF/WEBP whose filename or alt text contains
  "clippy", "clippit", or "office assistant", and no JSON with 40 or more animations.
- `classic-packs.md` contains the warning block from `13-licensing.md` §5.3 verbatim
  (asserted by a test that reads the file).
- `licensing.md` contains both copyright lines from `LICENSE` and the fork-point commit
  from `NOTICE.md` (asserted).

**Acceptance criteria.** The classic-packs page shows the loader call with placeholder URLs
only; it links to no file that contains the art; it links to the felixrieseberg/clippy
repository's license page as the example of a code-only MIT notice the integrator must read.

**Depends on.** A-08, V-14.

---

## V-16 Upstream tracking: tooling, `UPSTREAM.md`, and the first review

**Goal.** Make the policy in `01-architecture.md` §12 executable: the path-rewriting
cherry-pick helper, the review log, and one real review of whatever upstream has released
since the fork point, with the verdicts recorded.

**PRD requirements covered.** None directly; the maintenance half of owner decision 1
(2026-11-12).

**Files in the fork.** `tools/upstream-apply.mjs`, `UPSTREAM.md`, `test/upstream-apply.node.test.ts`,
`docs/guide/how-it-works.md` (the "tracking upstream" section, written here, linked from
V-14).

**Public API added.** None.

Rules:
- `tools/upstream-apply.mjs <sha>`: runs `git fetch upstream` (the remote must exist; the
  tool prints the `git remote add` line when it does not), `git format-patch -1 <sha>
  --stdout`, rewrites paths `packages/driver/src/` → `packages/core/src/engine/`, rewrites
  `driver-` class strings through the `namespace.ts` table and `[driver.js]` → `[virtualtour]`,
  refuses hunks that touch `hints.ts`, `checklist.ts`, `styles/hints.css`,
  `styles/checklist.css`, `styles/popover.css` (moved) with a clear message, then
  `git apply --3way --index`, and prints the commit trailer `Upstream: <sha> (<version>)`
  to add. Conflicts are left for the maintainer; the tool never commits.
- `UPSTREAM.md`: the policy text, the review log table (`upstream version | released |
  reviewed on | entries | verdict per entry (cherry-picked <our sha> / not needed / not
  applicable) | reviewer`), and the per-file table of which fork tasks changed each engine
  file (from `01-architecture.md` §3).
- The first review: whatever upstream has released after `1.12.1` by the time this task
  runs (none as of 2026-11-12; the review then records "no releases since the fork point"
  with the date). The task is not done until the log has at least that row.

**Tests/proof required.**
- Unit `upstream-apply.node.test.ts`: given a fixture patch (a small synthetic diff against
  `packages/driver/src/core/utils.ts` adding a `driver-` class string), the rewritten patch
  targets `packages/core/src/engine/core/utils.ts` and contains the `vt-` string; a fixture
  patch touching `hints.ts` is refused with exit code 2; a patch touching `popover.css`
  is refused with a message naming `src/styles/base.css`.
- Manual proof recorded in the PR: run the tool against one real upstream commit from
  before the fork point that touches an engine file (any commit in the `1.12.0`→`1.12.1`
  range), on a scratch branch, and show that the rewritten patch applies cleanly (or that
  it reports the expected conflict for a file a fork task changed), then discard the
  branch.

**Acceptance criteria.** `UPSTREAM.md` has the policy, the per-file table, and at least
one review row; the tool refuses the removed and moved files; the docs section exists.

**Depends on.** F-03 (namespace table), any one F task merged (so the per-file table is
not empty).

---

## V-17 Size tuning, API freeze, release readiness checklist

**Goal.** Record the final sizes against the soft targets, freeze the public API for
v1.0, and write everything a maintainer needs before tagging 1.0 without doing the
tagging, hosting, or publishing.

**PRD requirements covered.** NF-size, NF-perf, D-1 (types complete), D-3 (package
contents), PRD section 8 (legal review before 1.0, as amended by the fork decision),
AV-12.

**Files in the fork.** Any `src/**` file the size report points at (only if a cheap win is
visible; the targets are soft); `SIZE.md` (final numbers); `e2e/perf.spec.ts`;
`packages/core/API-FREEZE.md` (every exported name and type, checked by a unit test against
`src/index.ts` exports); `packages/core/CHANGELOG.md` (1.0.0 entry, with a "derived from
driver.js 1.12.1" line and the list of engine changes by F task);
`packages/core/LICENSE` (final), `packages/core/NOTICE.md` (final), `RELEASE-CHECKLIST.md`.

**Public API added.** None (freeze).

**Tests/proof required.**
- Size report run and `SIZE.md` updated; the PR states each entry's size and whether it is
  above its soft target and why.
- `e2e/perf.spec.ts` (chromium): a tour on a page with a 10 000-row list; during 2 s of
  continuous wheel scrolling the long-task count is 0 and the frame rate from
  `requestAnimationFrame` timestamps stays above 50 fps (a regression tripwire with a
  generous threshold; repositioning is the engine's rAF-based refresh, so this guards the
  capture-phase scroll listener from F-09, the class guards, and the avatar).
- `API-FREEZE.md` test passes.
- `npm pack --dry-run` for each package lists exactly the intended files (`dist/`,
  `schemas/`, `LICENSE`, `NOTICE.md`, `README.md`, `CHANGELOG.md`, `STYLES.md`, `ART.md`,
  and `dist/thumbtack/LICENSE-ART.md`); the art tripwire runs on the tarball.

**Acceptance criteria.** `RELEASE-CHECKLIST.md` contains, each with a checkbox: `LICENSE`
carries both copyright lines; `NOTICE.md` names the fork point tag and commit and lists
every file not carried over; `UPSTREAM.md` has a review row dated within 90 days; legal
review of `LICENSE`, `NOTICE.md`, `ART.md`, `LICENSE-ART.md` (CC0), and
`docs/avatar/classic-packs.md` done; full e2e matrix green on four engines (ported engine
suites and public suites); SSR gate green; size report run and recorded; accessibility
audit green in dialog and avatar modes; manual screen-reader run recorded; docs link check
green; no company or product names other than driver.js in the repository (grep for a
maintainer-supplied list); `grep -r "driver-" src/` empty; version numbers consistent
across packages.

**Depends on.** V-15, V-16.
