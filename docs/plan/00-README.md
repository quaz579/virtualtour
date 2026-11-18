# VirtualTour implementation plan (index)

VirtualTour is an MIT-licensed, framework-agnostic guided product tour library for the
web, built as a **fork of driver.js 1.12.1** (MIT, `github.com/nilbuild/driver.js`, tag
`1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`). driver.js's source is the
starting point of the codebase and lives in this repository under `src/engine/`; the
project changes it directly and has no runtime dependency. On top of the engine VirtualTour
adds a typed public API with events and a global registry, rich step content and buttons,
conditional and async steps, every positioning and overlay feature the PRD asks for, a
versioned JSON tour format, persistence, a theme, a motion add-on, React and Vue wrappers,
and an optional pluggable avatar (an animated character drawn from a sprite sheet) that
delivers each step in a speech bubble built natively by the popover renderer.

This folder is a complete, self-contained build plan. Someone with only these files, a
TypeScript toolchain, a browser, and a clone of driver.js at the tag above can build the
library. It is a plan only: it holds no library code and assumes no repository, hosting,
CI, or package registry (those are out of scope on purpose).

"VirtualTour" is a working name used in the text. The final product name, npm name, and
import path are not decided. Where this plan shows `import ... from 'virtualtour'`, read it
as "the core package, whatever it ends up being called".

**Revision 3 (2026-11-12).** Revision 1 planned an in-house engine (52 tasks). Revision 2
(commit `bbf5322`) planned a layer on a pinned driver.js with seven upstream pull requests
and a bundled-patch fallback. The owner then decided to fork: "if we're using driver.js
let's just fork it. We aren't waiting on anything." Revision 3 removes the pin, the contract
tests, the bundled-mode fallback, and the upstream track, and turns every former upstream
task and every previously dropped PRD item into a direct engine change. Nothing from the
PRD is dropped. The revision 2 files are gone from the folder so it holds no
contradictions; git history has them.

## Files

| File | What it holds |
|---|---|
| `00-README.md` | This index, how to use the plan, conventions, definition of done, the PRD coverage matrix. |
| `01-architecture.md` | The fork: stack and layout, public API, the module map of `src/engine/` (kept / changed / new), the naming decision, class names and the namespace, data flow, lifecycle and event ordering, the native presenter seam, security, upstream tracking policy and mechanics, the soft size target. |
| `02-avatar.md` | Avatar subsystem: sprite player, animation map, roles, the engine-built speaker layout and arrow, idle loop, reduced motion, pack loading API, the shipped original character ("Thumbtack"). |
| `03-schemas.md` | JSON schemas: tour schema v1 (every public field, and how each compiles to the engine), avatar pack schema v1, the "classic" animation map formats the loader accepts, progress record shape. |
| `04-tasks-M0-fork.md` | Milestone 0, fork bootstrap: import, build, license files; port the upstream test suites; rename, data attributes, namespace. |
| `05-tasks-M1-api.md` | Milestone 1, public API: config and compiler, engine seams, tour runtime and events, eligibility loop, content and buttons and the accessible name, action steps. |
| `06-tasks-M2-engine.md` | Milestone 2, engine features: scroll-container clipping, extra cut-outs, boundary and padding and `over`, auto/flip/shift, cross offset and RTL and arrow options, nested scrolling, absolute strategy, reveal options, per-corner radius, mount containers, reduced motion. |
| `07-tasks-M3-presentation.md` | Milestone 3, presentation: spotlight mapping and state classes, stylesheets and theme, accessibility audit. |
| `08-tasks-MA-avatar.md` | Milestone A, avatar: pack format, sprite player, Thumbtack, the engine speaker layout and presenter, animation selection, idle, loaders, hardening. |
| `09-tasks-M4-extras.md` | Milestone 4, extras: persistence, JSON tours and schemas, motion add-on. |
| `10-tasks-M5-polish.md` | Milestone 5, polish: React and Vue wrappers, docs site and migration page, avatar docs, upstream tracking tooling and first review, release readiness. |
| `11-testing.md` | Test strategy: the ported engine suites, Vitest projects, Playwright matrix, fixtures, gates. |
| `12-risks-open-questions.md` | Open questions (top five first), decisions already made, risks with mitigations (fork maintenance, losing upstream fixes, size). |
| `13-licensing.md` | MIT fork obligations and the two-notice `LICENSE`, `NOTICE.md` with the fork point, what the clean-room rules cover now (art only), the avatar recommendation with evidence, Thumbtack rules and its CC0 art license, the classic-pack docs page plan, loader rules. |
| `14-driverjs-comparison.md` | The comparison that led first to layering and then to the fork (kept as the evidence record; its "plan" column describes revision 1). |

## How to use this plan

1. Read `01-architecture.md` and `02-avatar.md` once, fully. Every task file assumes their
   names, module paths, and contracts. Do not rename public API members without updating
   those two files first.
2. Clone driver.js at tag `1.12.1` (repository `github.com/nilbuild/driver.js`) and read
   its source where the plan cites it (`packages/driver/src/<file>:<line>`). After task
   F-01 the same code is in this repository under `packages/core/src/engine/`.
3. Read `13-licensing.md` before writing a line of code. The engine is MIT code we own a
   copy of; the avatar art rules apply in full.
4. Work the milestones in order: M0, M1, M2, M3, MA, M4, M5. Inside a milestone, tasks list
   their dependencies; tasks without a shared dependency can run in parallel. M2's eleven
   engine tasks are independent of each other except where listed and can be spread across
   several people once V-03 exists.
5. Each task is sized for one pull request. Finish it to its acceptance criteria, including
   the listed unit and browser tests, before starting the next.
6. `11-testing.md` is the test contract. A task is not done until its listed tests exist
   and pass in the listed browsers, and the ported engine suites stay green.
7. Engine files (`src/engine/**`) never import from outside `src/engine/`. A PR that breaks
   that rule fails review.
8. When something in the plan turns out to be wrong in practice, change the plan file in the
   same PR as the code and say why in the PR description. Keep the plan truthful.

## Task format

Every task has the same shape:

- **ID**: `F-nn` (fork bootstrap or an engine change under `src/engine/`), `V-nn` (public
  API and everything outside the engine), `A-nn` (avatar).
- **Goal**: one or two sentences.
- **PRD requirements covered**: IDs from the source PRD (`T-*`, `N-*`, `S-*`, `B-*`, `A-*`,
  `P-*`, `H-*`, `SC-*`, `AD-*`, `X-*`, `ST-*`, `M-*`, `D-*`) plus `NF-*` for the PRD's
  non-functional section and `V1X-*` for the three v1 extras (persistence hooks, JSON tour
  schema, built-in counter). Avatar requirements are `AV-*`, defined in `02-avatar.md`.
  Where a task used to be an upstream PR in revision 2, it says so ("Was upstream task U-nn").
- **Files in the fork**: paths under the layout in `01-architecture.md` §1, with upstream
  line numbers at the fork point for engine changes.
- **Public API added**: exact names and signatures.
- **Tests/proof required**: unit (Vitest) and real-browser (Playwright) tests by name.
- **Acceptance criteria**: checkable statements.
- **Depends on**: task IDs that must be merged first.

## Task count

| Milestone | Tasks | IDs |
|---|---|---|
| M0 fork bootstrap | 3 | F-01 … F-03 |
| M1 public API | 6 | V-01 … V-06 |
| M2 engine features | 11 | F-04 … F-14 |
| M3 presentation | 3 | V-07 … V-09 |
| MA avatar | 8 | A-01 … A-08 |
| M4 extras | 3 | V-10 … V-12 |
| M5 polish | 5 | V-13 … V-17 |
| **Total** | **39** | |

## Definition of done (every task)

- Code is TypeScript, strict mode, no `any` in public types (the engine's existing
  `getState(): any` is the one allowed exception until a task removes it).
- No runtime dependencies in any package; wrappers list only their framework and the core
  package as peer dependencies.
- Unit tests listed for the task pass under Vitest; the ported engine suites stay green.
- Browser tests listed for the task pass in Chromium, Firefox, and WebKit (Edge is covered by
  the Chromium channel run; see `11-testing.md`).
- `import 'virtualtour'` in a Node process with no `window` or `document` does not throw
  (SSR gate).
- The size report runs and its output is in the PR description (soft targets, warn-only:
  core ≈ 21 KB, avatar ≈ 6 KB, motion ≈ 2 KB min+gzip).
- A task that touches `src/engine/` updates `test/fixtures/fork-point.sha256` and lists the
  changed engine files.
- Public API members have TSDoc comments. No other comments unless they carry a non-obvious
  "why".
- No mention of any company, product, customer, or ticket system anywhere in code, tests,
  docs, or fixtures. driver.js, its repository URL, and its author's copyright line are the
  one exception.
- American English in code identifiers, comments, docs, and commit messages.

## PRD coverage matrix

Legend: **inherited** = driver.js 1.12.1 code kept as is (only renamed in F-03);
**changed in fork** = a direct change under `src/engine/`; **new** = code outside
`src/engine/`. Nothing is dropped.

| PRD | Requirement (short) | inherited | changed in fork | new | Task |
|---|---|---|---|---|---|
| T-1 | create a tour from config | | | x | V-01, V-03 |
| T-2 | steps at init or later | x (`setConfig`) | | x | V-03 |
| T-3 | step defaults, deep merge | | | x | V-01 |
| T-4 | name feeds the id | | | x | V-01 |
| T-5 | overlay on/off | x | x (`overlay: false`) | x (mapping) | V-02, V-07 |
| T-6 | containers for dialog and overlay | x (`layerFor`) | x (`mountIn`, `dimMountIn`) | x (option) | F-13 |
| T-7 | Escape on by default, can be off | x | x (`allowEscape`) | x | V-02, V-03 |
| T-8 | arrow keys, can be off | x | x (`allowArrowKeys`) | x | V-02, V-03 |
| T-9 | exit confirmation | x (`onDestroyStarted`) | | x (prompt) | V-03 |
| T-10 | class prefix for multiple instances | | x (`namespace`, data attributes) | x (option) | F-03 |
| N-1 | start, promise | x | | x | V-03 |
| N-2 | next, back | x | | x (routing) | V-03 |
| N-3 | show by id or index | x (`moveTo`) | | x (ids) | V-03 |
| N-4 | promises resolve when visible, incl. waiting | | | x | V-03, V-04 |
| N-5 | cancel with event | x | | x | V-03 |
| N-6 | complete; past last step completes | x | | x | V-03 |
| N-7 | hide without ending | | | x (re-drive) | V-03 |
| N-8 | query methods | x | | x | V-03 |
| N-9 | add/remove steps while running | x (`setConfig`) | | x | V-03 |
| N-10 | one active tour, global manager | x (`replaced`) | | x (registry) | V-03 |
| N-11 | teardown releases resources | x | | x | V-03 |
| S-1 | title | x | | | V-05 |
| S-2 | body: string, array, Element, function | x (string) | | x (array, Element, fn) | V-05 |
| S-3 | accessible label | | x (`label` → `aria-label`) | x | V-05 |
| S-4 | close button label + attrs with guard | x (label) | | x (attrs) | V-05 |
| S-5 | custom classes | x (`popoverClass`) | | | V-05 |
| S-6 | metadata never interpreted | x (`data`) | | x | V-05 |
| S-7 | step id | | | x | V-01 |
| B-1 | footer of buttons | x (next/prev/close) | | x (custom) | V-05 |
| B-2 | built-in or custom actions | | | x | V-05 |
| B-3 | text/label as string or function | | | x | V-05 |
| B-4 | disabled boolean or function | | | x | V-05 |
| B-5 | classes, attrs, secondary | | | x | V-05 |
| A-1 | target: selector, element, function, lazy | x | | x | V-04 |
| A-2 | no/missing target → centered, no arrow | x | | | V-04 |
| A-3 | target but no placement → highlight, centered dialog | | x (`side: 'over'` for targets) | x (compile) | F-06 |
| A-4 | wait for element | x (own) | | x (layer waits, for A-9 order) | V-04 |
| A-5 | skip if missing; all-skipped rules | x (forward) | | x (backward, loop) | V-04 |
| A-6 | conditional display | | | x | V-04 |
| A-7 | pre-show async hook | | | x | V-04 |
| A-8 | wait/skip stay plain JSON | | | x | V-01, V-11 |
| A-9 | lookup before hook, documented | | | x | V-04, V-14 |
| P-1 | sides × alignments, auto | x (sides, fallback) | x (`auto`) | x (compile) | F-07 |
| P-2 | offset main/cross; RTL | x (main) | x (per step; cross; RTL mirroring) | x | V-02, F-08 |
| P-3 | viewport and scroll-container padding | | x (boundary, `popoverPadding`) | x | F-06 |
| P-4 | flip side or alignment, can be off | x (side) | x (alignment flip, `flip: false`) | x | F-07 |
| P-5 | shift to stay in bounds, can be off | x (viewport) | x (boundary, `shift: false`) | x | F-06, F-07 |
| P-6 | absolute or fixed strategy | x (fixed) | x (`absolute`) | x | F-10 |
| P-7 | stays attached on scroll/resize of any ancestor | x (window, resize, target size) | x (capture scroll, lock option) | | F-09 |
| P-8 | centered steps use fixed | x | x (forced under `absolute`) | | F-10 |
| P-9 | arrow on/off; min inset | x (on) | x (`arrow: false`, `minInset`) | x | F-08 |
| P-10 | offset counted in fit | x | | | — |
| H-1 | dim with interactive cut-out | x | | x (`clickOutside`) | V-07 |
| H-2 | padding and radius, per corner | x (uniform) | x (per step; four corners) | x | V-02, F-12 |
| H-3 | extra highlights cut out | x (interactive, raised) | x (cut-out anywhere) | x (mapping) | F-05, V-07 |
| H-4 | nested highlights deduped | | x (rect dedupe) | x (class dedupe) | F-05, V-07 |
| H-5 | cut-out clipped by scroll containers | | x | x (option) | F-04 |
| H-6 | animated cut-out; reduced motion | x (tween, duration) | x (reduced motion) | | F-14 |
| H-7 | state classes + custom class | x (target markers) | x (namespaced) | x (extras, custom) | F-03, V-07 |
| H-8 | block target clicks | x | | | V-07 |
| SC-1 | scroll into view, off, native options | x (default rule) | x (`false`, options) | x | F-11 |
| SC-2 | custom scroll handler | | x (skip engine scroll) | x | V-04, F-11 |
| AD-1 | advance on event on selector | x (on the target; `strict`) | | x (other selectors) | V-04, V-06 |
| AD-2 | advance programmatically + docs | x (`advance`) | | x | V-06, V-14 |
| 3.10 | tour, step, manager events; ordering; emitter | x (one callback per hook) | x (`onStepCompleted`, `onReposition`) | x (emitter, ordering) | V-01, V-02, V-03, V-06 |
| 3.11 | step instance API | x (`updatePopover`) | | x | V-05 |
| X-1 | dialog semantics, named | x (titled) | x (untitled) | | V-05, V-09 |
| X-2 | focus moves in; ring optional | x | | x (`first-button`, theme ring) | V-05, V-08 |
| X-3 | focus stays in; returns | x | | | V-09 |
| X-4 | Escape, arrows, Tab | x | | | V-09 |
| X-5 | reduced motion everywhere | x (CSS parts) | x (JS tween, fade) | x (avatar, glide) | F-14, A-06, V-12 |
| X-6 | WCAG 2.2 AA | | | x (audit) | V-09, A-08 |
| ST-1 | minimal base stylesheet | x (`driver.css`, `popover.css`) | x (`engine.css` on data attributes) | x (`base.css`) | F-03, V-08 |
| ST-2 | warn if stylesheet missing | | | x | V-08 |
| ST-3 | theme with dark mode, variables | | | x | V-08 |
| ST-4 | stable class names | x | x (renamed) | x | F-03, V-08 |
| M-1 | glide | | | x | V-12 |
| M-2 | progress CSS variables | | | x | V-12 |
| M-3 | add-ons return an off function | | | x | V-12 |
| 3.15 | progress indicators, custom counter docs | x (`showProgress`) | | x (function counter, docs) | V-05, V-12 |
| action steps | instruction, nudge, advanceDelay, advance in the public API | x (engine) | x (`onStepCompleted`, `onNudge`) | x (API, events, JSON) | V-06 |
| D-1 | ESM + types, named and default exports | | | x | F-01 |
| D-2 | CDN availability | | | | out of scope (hosting) |
| D-3 | CSS as separate imports | x | | x | F-01, V-08 |
| D-4 | release artifacts | | | | out of scope |
| D-5 | React and Vue wrappers | | | x | V-13 |
| D-6 | zero runtime dependencies | | | x (the fork has none) | F-01 |
| D-7 | last two browser versions | x | | x (matrix) | F-01, V-17 |
| NF-size | core about 15 KB | | | x (soft target ≈ 21 KB, warn-only) | F-01, V-17 |
| NF-perf | rAF repositioning, no thrash | x | | x (tripwire) | V-17 |
| NF-security | no code from strings; sanitizer hook | | | x | V-05, V-06, V-11 |
| NF-ssr | import touches no DOM | x | | x (gate) | F-01 |
| NF-tests | unit + e2e incl. scroll containers, fixed headers, RTL | x (ported suites) | x (new engine tests) | x | F-02, 11-testing |
| NF-docs | guide, API, cookbook, migration, demo | | | x | V-14, V-15 |
| V1X-persist | persistence hooks | | | x | V-10 |
| V1X-json | JSON tour schema | | | x | V-11 |
| V1X-counter | built-in counter | x | | x (function form) | V-05 |
| AV-1 … AV-12 | avatar | | x (speaker layout, bubble arrow) | x | A-01 … A-08 |

Out of v1 (documented as "later" in `12-risks-open-questions.md` §4): analytics adapter,
hotspots and beacons (upstream's hints can be restored from the fork-point tag), route
awareness, tours inside shadow roots or iframes.

## Glossary

- **Engine**: the forked driver.js code under `src/engine/`, created per run by
  `createEngine()`; never exported from the package.
- **Fork point**: driver.js tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`.
- **Tour**: ordered steps with shared settings and events.
- **Step**: one popover (or one speech bubble in avatar mode).
- **Target**: the page element a step points at (the engine calls it the element).
- **Spotlight**: the overlay's cut-out around a target (the engine calls it the stage).
- **Presenter**: the object that decorates the popover for a step. The default presenter
  builds a dialog; the avatar presenter asks the engine for the `speaker` layout and fills
  its avatar slot.
- **Mechanism attribute**: a fixed `data-vt-*` attribute the functional CSS keys on; never
  configurable.
- **Namespace**: the `namespace` option's prefix for styling classes and informational data
  attributes on page-owned elements (default `vt`).
- **Pack**: an avatar's sprite sheet image plus its JSON animation map.
- **Registry**: the global manager that knows the active tour and relays its events.
- **Upstream**: the driver.js repository after the fork point; reviewed, never depended on.
