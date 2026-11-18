# 09. Milestone 4: extras

Outcome: the three v1 extras (persistence hooks, versioned JSON tours with shipped
schemas, built-in counter — the counter landed in V-05) plus the motion add-on. All three
tasks are independent of each other and of the avatar milestone; they need M1 (and the M2
fields they serialize).

Tasks: V-10, V-11, V-12.

---

## V-10 Persistence hooks

**Goal.** A pluggable progress store with localStorage and in-memory implementations;
skip completed tours and optionally resume.

**PRD requirements covered.** V1X-persist, S-6 (meta stays untouched), PRD section 1.2
(no server persistence; app decides).

**Files in the fork.** `src/persist/types.ts`, `src/persist/local-storage.ts`,
`src/persist/memory.ts`, `src/tour.ts` (consult on `start`, save on `step-shown`,
`finished`, `exited`), `src/index.ts`, `test/persist.test.ts`, `e2e/persist.spec.ts`,
`demo/fixtures/persist.html`.

**Public API added.**
```ts
interface ProgressRecord { tourId: string; lastStepId?: string; completedAt?: string; exitedAt?: string; updatedAt: string }
interface ProgressStore {
  load(tourId: string): Promise<ProgressRecord | null> | ProgressRecord | null;
  save(record: ProgressRecord): Promise<void> | void;
  clear(tourId: string): Promise<void> | void;
}
interface ProgressConfig { store: ProgressStore; skipCompleted?: boolean /* default true */; resume?: boolean /* default false */ }
TourConfig.progress?: ProgressConfig;
function localStorageStore(prefix?: string): ProgressStore;
function memoryStore(): ProgressStore;
// tour event `bypassed` { tour, reason: 'completed' }
```

Rules: `03-schemas.md` §3. `start()` awaits `store.load`; store errors are caught and
treated as `null` (dev warning). Saves are fire-and-forget (errors reported in dev).
`resume: true` starts at `lastStepId` when it still exists (through the navigator, so
eligibility rules apply), else at the first step. `exited` with reason `replaced` does not
save `exitedAt` (the user did not leave; another tour took over). `tour.id` must be
stable; the docs say to set `id` explicitly and the dev build warns when `progress` is set
without one.

**Tests/proof required.**
- Unit (jsdom): `memoryStore` round trip; `localStorageStore` key format, corrupt JSON →
  null, quota error caught; `skipCompleted` → `bypassed` and no `started`; `resume` → first
  `step-shown` is the saved step; `exited` saves `exitedAt` and `lastStepId`; `replaced`
  does not; a throwing store does not break `start()`; dev warning without `id`.
- e2e (3 browsers): complete a tour, reload, `start()` emits `bypassed` and renders nothing;
  exit at step 2 with `resume: true`, reload, `start()` shows step 2; `store.clear(id)` then
  reload starts from step 1. Uses the real `localStorage`.

**Acceptance criteria.** Zero `localStorage` access at import (SSR gate still passes with
the persist module exported from the core entry).

**Depends on.** V-04.

---

## V-11 JSON tours: parse, serialize, schema files, conformance tests

**Goal.** Load a tour from the versioned JSON format and write one back, resolving
functions through a `handlers` map and elements through selectors; ship both JSON Schema
files and prove every example conforms. The schema covers every public field, including the
M2 positioning fields and the action-step fields.

**PRD requirements covered.** V1X-json, A-8, NF-security (no string-to-code), AV-1
(pack schema shipped), T-6 and T-10 in JSON form.

**Files in the fork.** `src/json/tour-json.ts`, `src/index.ts`,
`schemas/tour.v1.schema.json`, `schemas/avatar-pack.v1.schema.json` (full versions of the
skeletons in `03-schemas.md`), `test/json/tour-json.test.ts`, `test/schemas.test.ts`,
`package.json` (`exports["./schemas/*"]`, `files`), `docs/examples/tours/*.json`.

**Public API added.** `parseTourJson(json, { handlers })`, `serializeTour(config, {
handlerNames, elementSelectors? })`, `TourJsonError`, type `TourJsonV1`; the two schema
files as package exports.

Rules: `03-schemas.md` §1. The parser is hand-written: it walks the object, checks types,
and throws `TourJsonError` with a JSON path like `steps[2].buttons[0].action.handler`.
Unknown keys throw (strict). `extensions` passes through untouched. `mountIn` /
`dimMountIn` strings become `() => document.querySelector(sel)` thunks that throw
`TourEnvironmentError` with the path when nothing matches. `serializeTour` needs
`handlerNames` for any function it meets and `elementSelectors` for any element. The result
of `parseTourJson` is a plain `TourConfig`; `createTour(parseTourJson(...))` then compiles
it like any other config.

**Tests/proof required.**
- Unit: the full example from `03-schemas.md` §1.2 parses to the expected `TourConfig`
  (functions compared by identity to the handlers map; `mountIn` resolved against a jsdom
  document); every error path (bad `format`, unknown key, unknown handler, wrong type, an
  `offset` object with an unknown key, a `placement` with an invalid side) reports the right
  path; `serializeTour(parseTourJson(x))` round-trips; a JSON `body` array becomes
  `string[]`; `createTour(parseTourJson(...)).start()` runs in jsdom against the real engine
  with an action step and a per-corner radius.
- Schema conformance with a dev-only JSON Schema validator: every `*.json` under
  `docs/examples/tours/` validates; the Thumbtack `pack.json` validates; the synthetic test
  pack validates; twelve malformed fixtures fail with the expected keyword; the hand-written
  parser and the schema agree on every fixture (both accept or both reject).

**Acceptance criteria.** No `Function` constructor or `eval` in the module (grep in the
test); schemas carry `$id`, `title`, and `description` on every property; every
`StepConfig` and `TourConfig` key in `01-architecture.md` §2 appears in the schema or in
the "code-only" list in `docs/guide/json-tours.md` (`body` as Element, `mountIn` as
Element).

**Depends on.** V-06, A-01 (for the pack schema test fixture), F-07, F-08, F-10, F-12,
F-13 (so the fields exist end to end).

---

## V-12 Motion add-on: glide and progress variables

**Goal.** `./motion` entry: animate the popover from the previous step's position to the
next instead of fading in, and expose the step index and total as CSS variables.

**PRD requirements covered.** M-1, M-2, M-3, X-5, section 3.15 (custom counter cookbook).

**Files in the fork.** `src/motion/index.ts`, `src/motion/glide.ts`,
`src/motion/progress.ts`, `src/styles/theme.css` (the optional progress bar from V-08
gets its fill rule), `test/motion/glide.test.ts`, `test/motion/progress.test.ts`,
`e2e/motion.spec.ts`, `demo/fixtures/motion.html`, `docs/cookbook/custom-counter.md`.

**Public API added.**
```ts
glide(tour, { durationMs = 250, easing = 'cubic-bezier(.2,.8,.2,1)' }): () => void
progressVars(tour): () => void   // sets --vt-progress-index / --vt-progress-total on the popover
```

Rules:
- `glide`: on `will-hide` record the current wrapper's rect; on `shown` (the new wrapper
  exists and is positioned, invariant 5) apply a FLIP with the Web Animations API:
  transform from the delta to identity over `durationMs`, and suppress the engine's fade for
  that step by adding `vt-glide` to the wrapper (CSS `.vt-glide { animation: none }` ships
  in `base.css`). Cancel on the next step change; no-op under reduced motion
  (`prefersReducedMotion()` from `engine/core/env.ts`), when `animate` is off, when the
  previous step was centered and the new one is not (or the reverse), or across presenters
  (dialog → speaker). The returned function removes the listeners.
- `progressVars`: on every `step-shown` set `--vt-progress-index` and `--vt-progress-total`
  (from `progressInfo()`) on the wrapper; the returned function removes the listener.

**Tests/proof required.**
- Unit (jsdom with `Element.prototype.animate` stubbed): delta math; cancel on rapid
  navigation; off function detaches; reduced motion no-op; variables set and updated;
  removed after the off function.
- e2e (3 browsers): with `durationMs: 400`, sample the wrapper's transform 100 ms after
  `forward()` and assert it is between the two positions; final position equals the
  engine's computed one; reduced motion → at the final position immediately; the progress
  bar width equals `index / total` of the wrapper width within 1 px across steps; the
  cookbook's custom counter (using `step-shown` and `progressInfo()`) renders the right
  text.

**Acceptance criteria.** `motion.js` is a separate entry, imports the core entry as
external, and the size report shows it near 2 KB min+gzip.

**Depends on.** V-05, V-08.
