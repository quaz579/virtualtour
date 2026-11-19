# 01. Architecture (fork of driver.js)

This file is the contract every task file builds against. VirtualTour is a **fork of
driver.js 1.12.1** (MIT, `github.com/nilbuild/driver.js`, tag `1.12.1`, commit
`0163642dc532417ea401684bd26690e2f3283d63`). The fork is the starting point of the
codebase, not a dependency: its source lives in this repository under `src/engine/`, we
change it directly, and the package has no runtime dependency. Nothing waits on an upstream
pull request (owner decision, 2026-11-12: "if we're using driver.js let's just fork it. We
aren't waiting on anything").

What driver.js gives the fork on day one: step navigation, the popover and its content
updates, positioning with side fallback, the SVG overlay cut-out with its tween, focus trap
and restore, keyboard handling, waiting for late elements, skip-missing, `advanceOn`, action
steps (`instruction`, `nudge`, `advanceDelay`), the live region, `<dialog>` layering, and a
test suite of about 7 100 lines of jsdom unit tests and 7 500 lines of Playwright specs
(about 12 000 lines after the hints and checklist suites are left out).

What VirtualTour adds on top, inside the same codebase: the public `Tour`/`TourStep` API with
a typed event emitter and a global registry, rich step content and buttons, the eligibility
loop (`shouldShow`, `waitFor`, `whenMissing`, `prepare`), every positioning and overlay
feature the PRD asks for that driver.js lacked, a configurable namespace, mount containers, a
versioned JSON tour format, persistence, a theme, a motion add-on, React and Vue wrappers, and
the pluggable avatar with its speech bubble built natively into the popover.

Evidence references below are `packages/driver/src/<file>:<line>` in the driver.js repository
at tag `1.12.1`. After task F-01 the same code is at `packages/core/src/engine/<file>` in this
repository, so a reference like `popover/position.ts:55` means both places until a fork task
changes that file.

---

## 1. Stack and package layout

| Concern | Choice |
|---|---|
| Language | TypeScript 5.x or later, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. The forked engine compiles under the same flags after F-01 (it was written for TypeScript 6 strict already). |
| Build | Vite library mode, ESM only, one bundle per entry, `.d.ts` via `vite-plugin-dts` (or `tsc --emitDeclarationOnly`). driver.js's `tsdown` build is not kept. |
| Runtime dependencies | **None.** (`dependencies` is absent from `package.json`; PRD D-6 holds again.) |
| Unit tests | Vitest with `jsdom` for DOM units (driver.js tests on jsdom too, so its ported suite runs unchanged in spirit), `node` environment for pure logic and the SSR gate |
| Browser tests | Playwright: `chromium`, `chromium` with `channel: 'msedge'` (optional), `firefox`, `webkit` |
| Node for tooling | Node 20 LTS or newer |
| Package manager | any; the plan uses `npm` in examples (driver.js uses pnpm + turbo; neither is kept) |

Workspace layout (one repository, npm workspaces; hosting is out of scope):

```
LICENSE                       # MIT, two copyright lines (13-licensing.md §1)
NOTICE.md                     # fork provenance: driver.js tag + commit, upstream URL, the original notice
UPSTREAM.md                   # how we track upstream after the fork (§12)
packages/
  core/                       # the library: entries ".", "./avatar", "./motion", CSS files
    src/
      index.ts                # public exports of the core entry
      engine/                 # THE FORKED ZONE: driver.js source, changed in place (§3)
        driver.ts             # createEngine() factory (was driver()); not exported from the package
        types.ts              # engine Config / DriveStep / Popover / hooks
        core/  context.ts, options.ts, utils.ts, click.ts, env.ts (new), namespace.ts (new)
        popover/ popover.ts, position.ts, live-region.ts
        overlay/ overlay.ts, stage.ts
        tour/  highlight.ts, step.ts, lifecycle.ts, advance.ts, allowed.ts, wait.ts, completion.ts, removal.ts, nudge.ts
        interaction/ events.ts, gate.ts, gesture.ts, keys.ts, region.ts, trust.ts
        styles/ engine.css    # the functional rules (was driver.css); popover.css folded into styles/base.css
      tour.ts                 # Tour class: public API, owns one engine instance per run
      step.ts                 # TourStep class
      registry.ts             # global registry (singleton `tours`)
      events.ts               # typed emitter used by Tour, TourStep, registry
      config.ts               # defaults, deep merge (T-3), validation, ids
      compile.ts              # TourConfig/StepConfig -> engine Config/DriveStep (pure)
      navigator.ts            # eligibility loop (shouldShow, waitFor, whenMissing, prepare), serialization
      presenter.ts            # Presenter interface + DialogPresenter (default)
      render/
        parts.ts              # layer parts added into the popover (body, footer)
        content.ts            # body normalization (string | string[] | Element | fn), sanitizer hook
        buttons.ts            # custom button DOM + action binding
      dom/
        frame.ts              # tiny rAF scheduler (sprite player, glide)
        target.ts             # resolve target (A-1), waitFor (A-4)
      spotlight/
        options.ts            # dim/spotlight config -> engine overlay options; state classes
      advance/
        auto-advance.ts       # AD-1 selector case (target case uses engine advanceOn)
      persist/
        types.ts, local-storage.ts, memory.ts
      json/
        tour-json.ts          # parseTourJson(), serializeTour(), TourJsonError
      styles/
        base.css              # ST-1: engine.css + popover visuals (the forked popover.css, renamed classes)
        theme.css             # ST-3
        avatar.css            # speaker layout
      motion/
        index.ts              # entry "./motion": glide(), progressVars()
      avatar/
        index.ts, pack.ts, classic.ts, player.ts, idle.ts, speaker.ts, thumbtack/
    schemas/
      tour.v1.schema.json
      avatar-pack.v1.schema.json
    test/                     # Vitest units (mirrors src/); test/engine/** holds the ported driver.js suite
    e2e/                      # Playwright specs + fixtures; e2e/engine/** holds the ported driver.js specs
    tools/
      build-thumbtack-pack.mjs
      make-test-pack.mjs
      size-report.mjs         # prints sizes; warns above the soft targets; never fails (§13)
      upstream-apply.mjs      # path-rewriting cherry-pick helper (§12.2)
  react/                      # wrapper: TourProvider + useTour
  vue/                        # wrapper: plugin + useTour
docs/                         # docs site (VitePress suggested)
demo/                         # Vite demo app used by e2e and the docs "live demo"; demo/e2e.html is the bare fixture page
```

Package `exports` for core (names are placeholders; the npm name is out of scope):

```json
{
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./avatar": { "types": "./dist/avatar.d.ts", "import": "./dist/avatar.js" },
  "./motion": { "types": "./dist/motion.d.ts", "import": "./dist/motion.js" },
  "./base.css": "./dist/base.css",
  "./theme.css": "./dist/theme.css",
  "./avatar.css": "./dist/avatar.css",
  "./thumbtack/pack.json": "./dist/thumbtack/pack.json",
  "./thumbtack/sheet.png": "./dist/thumbtack/sheet.png",
  "./schemas/*": "./schemas/*"
}
```

The core entry has a default export (`createTour`) and named exports (D-1). The engine
factory `createEngine` is **not** exported from any entry; tests import it from
`src/engine/driver.ts` directly.

### 1.1 Where each concern lives

| Concern | Inherited from driver.js, kept as is | Changed in the fork | New in VirtualTour (outside `src/engine/`) |
|---|---|---|---|
| Step navigation and state | `drive`, `moveNext/Previous/To`, `destroy` with reasons, waiting for elements, skip-missing, `advanceOn`, `advance()`, action steps, nudge, `<dialog>` layering, framework re-render following | `allowEscape` / `allowArrowKeys` split (T-7, T-8); per-step `stagePadding`, `stageRadius`, `popoverOffset`; `overlay: false` | `Tour`/`TourStep`, promises resolving on `shown`, eligibility loop, add/remove steps while running, registry, typed events |
| Popover | DOM, HTML title/description, next/prev/close, progress text, `updatePopover`, instruction and feedback rows, image-load reposition | `label` for untitled steps (X-1, S-3); `layout: 'dialog' \| 'speaker'` with `bubble` and `avatarSlot` parts; presenter hooks called from the renderer; `arrow: false` | Element/function/array bodies, custom buttons, counter function, sanitizer hook, `configure()` |
| Positioning | side/align, side fallback, viewport clamp, arrow geometry, reposition on scroll/resize/target size | boundary (viewport ∩ scroll parents) and `viewportPadding` (P-3); `side: 'over'` for targets (A-3); `placement: 'auto'` (P-1); `flip` and `shift` switches plus alignment flip (P-4, P-5); cross-axis offset and RTL mirroring (P-2); arrow `minInset` (P-9); `strategy: 'absolute'` (P-6); capture-phase scroll (P-7) | nothing (all positioning is engine code) |
| Overlay | SVG cut-out, padding, radius, tween, click handling, allowed elements, `<dialog>` cut-outs | cut-out clipped by scroll parents (H-5); extra cut-outs anywhere, deduped (H-3, H-4); per-corner radius (H-2); reduced motion for the tween and the fade (H-6, X-5); scroll-lock option (P-7); `mountIn` / `dimMountIn` (T-6) | option mapping, state classes on target and extras, `clickOutside` |
| Accessibility | `role=dialog`, focus in/trap/restore, Escape/arrows that skip editable widgets, live region | accessible name for untitled steps; reduced motion in JS | WCAG audit, docs |
| Naming and theming | class contract, CSS variables | `driver-` → `vt-` everywhere; functional CSS keyed on fixed data attributes; `namespace` prefix for state classes (T-10) | `base.css`, `theme.css`, dark mode |
| Persistence, JSON, motion, wrappers, avatar | none | the popover's `speaker` layout and `avatarSlot` (engine side of the avatar) | all of it |

---

## 2. Public API (core entry)

The public API is VirtualTour's own (see §4 for the naming decision). It never exposes engine
types. There is no `tour.engine` escape hatch any more: everything an integrator could reach
through it in the layered design (action steps, nudge, advance) is now a first-class public
member.

### 2.1 Creating a tour

```ts
import { createTour, tours } from 'virtualtour';
import 'virtualtour/base.css';

const tour = createTour(config: TourConfig): Tour;
```

`createTour` is also the default export. The other value exports are `Tour`, `TourStep`, `Emitter`,
`TourEnvironmentError`, `TourNavigationError`, `parseTourJson`, `serializeTour`, `TourJsonError`,
`localStorageStore` and `memoryStore`; every type in `types.ts` is exported as a type.

```ts
interface TourConfig {
  id?: string;                    // T-4: defaults to `<name-slug>-<random>`
  name?: string;
  steps?: StepConfig[];           // T-2
  stepDefaults?: Partial<StepConfig>; // T-3, deep-merged key by key for nested groups
  dim?: boolean | DimConfig;      // T-5 overlay; `true` = DimConfig defaults; absent or `false` draws no overlay (engine `overlay: false`)
  mountIn?: Element | (() => Element);     // T-6 container for popovers; default: document.body or the open <dialog> (engine layerFor)
  dimMountIn?: Element | (() => Element);  // T-6 container for the overlay; default: same rule
  namespace?: string;             // T-10 prefix for classes and data attributes added to page elements (popover classes stay fixed); default 'vt'
  keys?: { escape?: boolean; arrows?: boolean }; // T-7, T-8; both default true
  exitPrompt?: false | string | (() => boolean | Promise<boolean>); // T-9; a string runs `window.confirm` (synchronous), a function may be async; a throwing function keeps the tour open
  counter?: boolean | ((index: number, total: number) => string); // V1X-counter
  labels?: { next?: string; back?: string; done?: string; close?: string };
  progress?: ProgressConfig;      // V1X-persist: `{ store, skipCompleted?, resume? }`, see §2.7
  presenter?: PresenterFactory;   // extension point; the avatar entry sets this (§8); `(tour, context: PresenterContext) => Presenter`
  sanitize?: (html: string) => string; // NF-security optional sanitizer hook; memoized, runs once per HTML string
  animate?: boolean;              // engine `animate`; default true; the engine itself turns motion off under reduced motion (F-14)
  waitBudget?: number;            // ms one navigation may spend waiting for targets across consecutive `waitFor` steps; default 10000; 0 or Infinity removes the cap (§7.3)
}

interface DimConfig {
  padding?: number;              // H-2, default 10 (engine stagePadding)
  radius?: number | CornerRadius; // H-2 uniform or per corner, default 5 (engine stageRadius)
  transitionMs?: number;         // H-6, default 400 (engine duration)
  color?: string;                // default '#000' (engine overlayColor)
  opacity?: number;              // default 0.7 (engine overlayOpacity)
  clickOutside?: 'none' | 'exit' | 'forward'; // default 'none' (H-1: dimmed area swallows clicks)
  pageScroll?: boolean;          // default true (engine allowScroll)
  lockScrollParent?: boolean;    // default false (P-7); true keeps driver.js's behavior of freezing the target's scroll parent (driver.js always froze it)
  clipToScrollParents?: boolean; // default true (H-5)
}

interface CornerRadius { topLeft?: number; topRight?: number; bottomRight?: number; bottomLeft?: number }
```

### 2.2 Step configuration

```ts
interface StepConfig {
  id?: string;                                  // S-7; defaults to `step-<n>` (n counts from 1 per tour, skipping ids in use); progress and resume need explicit ids
  title?: string | (() => string);              // S-1
  body?: BodyContent;                           // S-2; an element or fragment is deep-cloned into the popover on each mount
  label?: string | (() => string);              // S-3 accessible name when no title
  closeButton?: boolean | { label?: string | (() => string); attrs?: Record<string, string> }; // S-4
  classes?: string | string[];                  // S-5
  meta?: JsonValue;                             // S-6, never interpreted
  buttons?: ButtonConfig[];                     // B-1..B-5; when set, the engine's next/back buttons are hidden

  target?: TargetRef;                           // A-1
  placement?: PlacementRef;                     // P-1; absent with a target = highlight + centered dialog (A-3); absent without a target = centered
  position?: PositionOptions;                   // P-2..P-6, P-9
  waitFor?: number;                             // A-4 ms
  whenMissing?: 'center' | 'skip';              // A-5, default 'center'
  shouldShow?: () => boolean;                   // A-6
  prepare?: () => Promise<unknown> | unknown;   // A-7
  hookTimeout?: number;                         // ms `prepare` and `revealWith` may each take; on timeout a warning is logged and the step shows; default 10000; 0 or Infinity waits forever (§7.3)
  spotlight?: SpotlightOptions;                 // H-2, H-3, H-7, H-8 per step
  reveal?: boolean | 'smooth' | ScrollIntoViewOptions; // SC-1; default true (engine rule: center, auto behavior)
  revealWith?: (target: Element) => void | Promise<void>; // SC-2, replaces the engine scroll
  autoAdvance?: { event: string | string[]; selector?: string; strict?: boolean }; // AD-1
  instruction?: string | (() => string);        // action step: the user must do this before Next works (engine popover.instruction)
  advanceDelay?: number;                        // ms to stay on a completed action step before moving on (engine advanceDelay)
  focus?: 'dialog' | 'first-button';            // X-2, default 'dialog'
  extensions?: Record<string, unknown>;         // namespaced bag for presenters (avatar uses `avatar`)
}

type BodyContent = string | string[] | Element | DocumentFragment | (() => string | string[] | Element | DocumentFragment);
type TargetRef = string | Element | (() => string | Element | null | undefined);
type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';
type PlacementRef = 'auto' | { side: Side | 'auto' | 'over'; align?: Align };

interface PositionOptions {
  offset?: number | { main?: number; cross?: number }; // P-2; main default 10 (engine popoverOffset); cross default 0, mirrored in RTL
  viewportPadding?: number;          // P-3, default 0; distance from the boundary (viewport ∩ scroll parents)
  boundary?: 'viewport' | 'scrollParents'; // P-3, default 'scrollParents'; 'viewport' ignores the target's scroll parents
  flip?: boolean;                    // P-4, default true (side fallback, then alignment flip)
  shift?: boolean;                   // P-5, default true (slide along the edge to stay inside the boundary)
  strategy?: 'fixed' | 'absolute';   // P-6, default 'fixed' (12-risks-open-questions.md question #1)
  arrow?: boolean | { minInset?: number }; // P-9, default true, minInset default 15 (engine ARROW_CORNER_INSET)
}

interface SpotlightOptions {
  padding?: number;                  // per-step override of dim.padding
  radius?: number | CornerRadius;    // per-step override of dim.radius
  extra?: string[];                  // H-3 extra selectors, cut out and kept interactive; H-4 dedupe applies
  class?: string;                    // H-7 custom class on target and extras
  targetInteractive?: boolean | 'hover-only'; // H-8; false = engine disableActiveInteraction true; 'hover-only' = "clicks"
}

interface ButtonConfig {
  text: string | (() => string);                 // B-3
  label?: string | (() => string);               // B-3 accessible label
  action: 'forward' | 'backward' | 'exit' | 'finish' | ((ctx: { tour: Tour; step: TourStep }) => void); // B-2
  disabled?: boolean | (() => boolean);          // B-4
  kind?: 'primary' | 'secondary';                // B-5
  classes?: string | string[];                   // B-5
  attrs?: Record<string, string>;                // B-5
}
```

Nothing from the PRD is dropped. The fields the layered design had removed (`mountIn`,
`dimMountIn`, `namespace`, per-corner `radius`, `offset.cross`, `viewportPadding`, `flip`,
`shift`, `strategy`, `arrow.minInset`, `placement: 'auto'`, `reveal: false | options`) are
back, each implemented as an engine change in `06-tasks-M2-engine.md`.

### 2.3 Tour instance

```ts
class Tour {
  readonly id: string;
  readonly name?: string;
  readonly steps: readonly TourStep[];
  readonly currentStep: TourStep | null;          // N-8

  start(): Promise<void>;                         // N-1
  forward(): Promise<void>;                       // N-2 next
  backward(): Promise<void>;                      // N-2 back
  goTo(ref?: string | number | TourStep): Promise<void>; // N-3 index, id or step; rejects with TourNavigationError for no match
  exit(): Promise<boolean>;                       // N-5 cancel; false if the prompt declined
  finish(): void;                                 // N-6 complete
  hideCurrent(): void;                            // N-7
  isRunning(): boolean;                           // N-8
  stepById(id: string): TourStep | undefined;     // N-8
  appendStep(def: StepConfig, at?: number | string): TourStep; // N-9
  dropStep(ref: string | TourStep): void;         // N-9
  progressInfo(): ProgressInfo;                   // V1X-counter: `{ index, total }`, index 1-based and 0 while no step is on screen
  refresh(): void;                                 // forces a reposition (engine refresh)

  advance(): void;                                 // completes the current action step from code (engine advance); on a step without an instruction it only moves forward
  nudge(message?: string): void;                   // shakes the popover and shows feedback (engine nudge); the avatar plays its `alert` role

  on / once / off                                  // typed, see §2.5
}
```

### 2.4 Step instance (PRD section 3.11)

```ts
class TourStep {
  readonly id: string;
  readonly tour: Tour;
  readonly config: Readonly<StepConfig>;
  readonly element: HTMLElement | undefined | null; // popover wrapper: undefined before first show, null after dispose
  readonly resolvedTarget: Element | null;

  show(): Promise<void>;        // tour.goTo(this)
  hide(): void;                 // tour.hideCurrent() when this is current
  exit(): Promise<boolean>;
  finish(): void;
  dispose(): void;
  isShown(): boolean;
  configure(patch: Partial<StepConfig>): void;  // merge + re-render in place if shown (engine updatePopover + presenter.update)

  on / once / off               // StepEvents
}
```

`element` is the `.vt-popover` wrapper for the step's most recent show. The engine destroys and
re-creates the popover on every step (`tour/step.ts:248-253`), so the element identity changes
between shows; `configure()` while shown keeps it.

### 2.5 Events

```ts
interface TourEvents {
  started: { tour: Tour };
  activated: { tour: Tour };
  deactivated: { tour: Tour };
  'step-shown': { tour: Tour; step: TourStep; previous: TourStep | null };
  'step-completed': { tour: Tour; step: TourStep };   // an action step's instruction was met (engine completion)
  finished: { tour: Tour };
  exited: { tour: Tour; reason: ExitReason };      // 'close' | 'escape' | 'overlay' | 'api' | 'replaced'
  bypassed: { tour: Tour; reason: 'completed' };   // V1X-persist: `start()` found a completed record and `skipCompleted` is on; the tour does not start
}

interface StepEvents {
  'will-show': { step: TourStep };
  shown: { step: TourStep };
  'will-hide': { step: TourStep };
  hidden: { step: TourStep };
  completed: { step: TourStep };   // action step instruction met
  finished: { step: TourStep };
  exited: { step: TourStep };
  disposed: { step: TourStep };
}
```

The `exited.reason` values are the engine's `DestroyReason` minus `done` (`types.ts:4`),
passed through unchanged.

### 2.6 Registry (N-10, section 3.10)

```ts
export const tours: {
  readonly current: Tour | null;
  on / once / off   // relays every TourEvents entry
};
```

The engine already enforces one active instance per page: starting a second instance tears
the first down with reason `replaced` (`driver.ts:45,90,381-384`). The registry mirrors that and
relays events.

### 2.7 Persistence, 2.8 JSON tours, 2.9 Motion, 2.10 Avatar

```ts
interface ProgressConfig { store: ProgressStore; skipCompleted?: boolean /* default true */; resume?: boolean /* default false */ }
interface ProgressStore { load(tourId): Promise<ProgressRecord | null> | ProgressRecord | null; save(record): Promise<void> | void; clear(tourId): Promise<void> | void }
interface ProgressRecord { tourId: string; lastStepId?: string; completedAt?: string; exitedAt?: string; updatedAt: string }
```

`localStorageStore` and `memoryStore` implement `ProgressStore` (`09-tasks-M4-extras.md` V-10; record
shape in `03-schemas.md` §3). `lastStepId` is a step id, so resuming only matches across page
loads when step ids are stable (explicit ids, not the generated `step-<n>`); a tour with `progress`
and no tour `id` logs a development warning. Saves are fire-and-forget: the tour does not wait for
`save`, each save runs after the previous one settles, and a failure logs a warning without
stopping the tour.

JSON (`03-schemas.md` §1): `parseTourJson`, `serializeTour`, `TourJsonError`. A document is
`{ "format": "virtualtour-tour/1", "$schema"?: string, ... }`; `$schema` is accepted and dropped on
parse, and `serializeTour` writes only `format`.

Motion (`virtualtour/motion`): `glide`, `progressVars`.

Avatar (`virtualtour/avatar`, `02-avatar.md`): `withAvatar`, `loadAvatarPack`, `loadClassicAvatarPack`,
`thumbtackPack`, `normalizePack`, `validatePack`, `resolveRole`, `preloadSheet`, `SpritePlayer`,
`SpeakerPresenter`, `IdleScheduler`, `AvatarPackError`.

---

## 3. The forked zone: `src/engine/` module map

Every file below starts as a byte-for-byte copy of `packages/driver/src/<path>` at tag
`1.12.1` (task F-01). The table says what happens to each file over the plan. "Kept" means
no task changes it except the rename pass (F-03: `driver-` class names and the
`driver.js` console prefix). Line numbers are at the fork point.

| File | Fate | Changed by |
|---|---|---|
| `driver.ts` | Changed. `driver()` becomes `createEngine()`; `init()` sets data attributes on `<body>` instead of classes (F-03); honors `overlay: false` (V-02); `handleEscape`/arrow handlers read `allowEscape`/`allowArrowKeys` (V-02); calls `presenter` hooks (V-02); emits completion to a hook `onStepCompleted` (V-06) | F-03, V-02, V-06 |
| `types.ts` | Changed. New `Config` keys: `allowEscape`, `allowArrowKeys`, `overlay`, `mountIn`, `dimMountIn`, `namespace`, `clipStageToScrollParents`, `allowedElementsCutout`, `popoverBoundary`, `popoverPadding`, `lockScrollParent`, `onStepCompleted`, `presenter`, `onReposition`. New `DriveStep` keys: `stagePadding`, `stageRadius` (number or corners), `popoverOffset`, `popoverCrossOffset`, `scrollIntoView`. New `Popover` keys: `label`, `layout`, `arrow`, `arrowMinInset`, `flip`, `shift`, `strategy`, `side: Side \| 'auto' \| 'over'` | V-02, F-04..F-14 |
| `core/context.ts` | Changed. Defaults for the new keys (`core/context.ts:44-65`) | V-02, F-04..F-14 |
| `core/options.ts` | Kept | |
| `core/utils.ts` | Changed. `clipRectByScrollParents()` extracted from `isClippedByScrollContainer` (109-142) (F-04); `layerFor` (150-180) honors `mountIn`/`dimMountIn` (F-13); `bringInView` (73-85) takes `ScrollIntoViewOptions \| false` (F-11); `prefersReducedMotion()` (F-14); `isRtl()` (F-08) | F-04, F-08, F-11, F-13, F-14 |
| `core/click.ts` | Kept | |
| `core/env.ts` | **New.** `isBrowser()`, `prefersReducedMotion()`, `isRtl(el)` (moved here from `utils.ts` so the public layer imports one small module) | F-14 |
| `core/namespace.ts` | **New.** Builds the class and data-attribute names from the `namespace` option (§5) | F-03 |
| `popover/popover.ts` | Changed. Class names (F-03); `label` → `aria-label` and placeholder text removed (V-05); `layout: 'speaker'` builds `bubble` + `avatarSlot` (A-04); `insertRow` targets `bubble ?? wrapper` (A-04); `presenter.mount` called right after `options.onRender` (V-02); `arrow: false` adds the no-arrow class (F-08) | F-03, V-02, V-05, F-08, A-04 |
| `popover/position.ts` | Changed the most. Boundary rect + padding replace `window.innerWidth/innerHeight` checks (F-06); `side: 'auto'` (F-07); `flip`/`shift`/alignment flip (F-07); cross offset + RTL (F-08); `minInset` (F-08); `strategy: 'absolute'` writes page coordinates (F-10); arrow measured against `bubble ?? wrapper` (A-04); returns `{ side, align }` for `onReposition` (V-02) | V-02, F-06, F-07, F-08, F-10, A-04 |
| `popover/live-region.ts` | Kept (class name only) | F-03 |
| `overlay/overlay.ts` | Changed. Clip by scroll parents (F-04); `allowedCutouts` everywhere + dedupe (F-05); `mountIn` for the overlay (F-13); reduced motion (F-14); `strategy` for the SVG (F-10) | F-04, F-05, F-10, F-13, F-14 |
| `overlay/stage.ts` | Changed. Four radii in `generateStageSvgPathString` (F-12); dedupe helper for extra rects (F-05) | F-05, F-12 |
| `tour/highlight.ts` | Changed. Class names → data attributes + namespaced classes (F-03); `isAnimatedTour` honors reduced motion (F-14); `lockScrollParent` (F-09); `bringInView` options (F-11); `presenter.beforeLeave`/`afterShow` calls (V-02) | F-03, V-02, F-09, F-11, F-14 |
| `tour/step.ts` | Changed. `resolveStepPosition` (164-174) reads per-step `stagePadding`/`popoverOffset`/cross offset/strategy/flip/shift/arrow (V-02, F-07, F-08, F-10); `label` passed through (V-05); `over` for targets (F-06) | V-02, V-05, F-06, F-07, F-08, F-10 |
| `tour/lifecycle.ts`, `tour/completion.ts`, `tour/removal.ts`, `tour/wait.ts`, `tour/advance.ts`, `tour/allowed.ts`, `tour/nudge.ts` | Kept (class names only; `completion.ts` calls `onStepCompleted`) | F-03, V-06 |
| `interaction/events.ts` | Changed. `onKeyup` (84-104) reads the split switches (V-02); `scroll` listener in capture phase (141, 159) (F-09); `onReposition` call after `refreshActiveHighlight` (V-02) | V-02, F-09 |
| `interaction/gate.ts`, `gesture.ts`, `keys.ts`, `region.ts`, `trust.ts` | Kept | |
| `styles/driver.css` → `styles/engine.css` | Changed. Functional rules keyed on data attributes (§5); fade keyframes under `prefers-reduced-motion: no-preference` (F-14) | F-03, F-14 |
| `styles/popover.css` | Moved into `src/styles/base.css` with renamed classes; `.vt-popover` gets `position` from `--vt-strategy` (F-10) | F-03, F-10, V-08 |
| `hints.ts`, `checklist.ts`, `styles/hints.css`, `styles/checklist.css` | **Removed in F-01.** Not in v1 scope; hotspots/beacons are a later item (`12-risks-open-questions.md` §4). The upstream tag holds them if a 1.1 wants to restore them. |
| `css.d.ts` | Kept | |

Rule for the forked zone: **engine files never import from outside `src/engine/`.** The
public layer imports the engine; never the reverse. That keeps upstream cherry-picks
(§12) applicable and keeps the engine testable with the ported driver.js suite alone.

### 3.1 Engine hooks the public layer wires

`Tour` creates one engine per run with `createEngine(config)` where `config` is the compiled
engine `Config` plus these hooks (names are the engine's own; they are internal to this
package now):

| Engine hook | What `Tour` does with it |
|---|---|
| `onHighlightStarted(el, step, { signal })` | step `will-show`; apply spotlight state classes |
| `onPopoverRender(popover, opts)` | not used by `Tour`; the engine calls `presenter.mount` itself (V-02) |
| `onHighlighted(el, step)` | step `shown` → tour `step-shown` → resolve the navigation promise; `presenter.afterShow` |
| `onDeselected(el, step)` | step `will-hide` → `hidden`; remove state classes (unless the next step shares the element); `presenter.beforeLeave` |
| `onNextClick` / `onDoneClick` / `onPrevClick` | route to `navigator.forward()` / `backward()` so the eligibility loop decides; the engine never moves on its own (`tour/step.ts:48-60`, `driver.ts:189-213`) |
| `onDestroyStarted(el, step, { reason })` | T-9 prompt for `close \| escape \| overlay`; `destroy()` when accepted; nothing when declined; `done` and `replaced` never prompt (`driver.ts:485-523`) |
| `onDestroyed(el, step, { reason })` | the finish/exit event sequences (§7.2) |
| `overlayClickBehavior` (function) | `dim.clickOutside` |
| `onStepCompleted(el, step)` (new, V-06) | step `completed` → tour `step-completed` |
| `onReposition(info)` (new, V-02) | `presenter.afterReposition(info)` (avatar dock and pointing) |

### 3.2 Engine facts the public layer relies on

These were "contract tests against a dependency" in the layered design. Now they are plain
unit tests in `test/engine/invariants.test.ts` (written in V-03), because the code is ours and
a change to any of them is a deliberate engine change, not an upgrade surprise.

1. `onPopoverRender` and `presenter.mount` run after content is applied and before
   `repositionPopover` (`popover/popover.ts:258,303-305`), so parts added there are measured
   and positioned.
2. `renderStepPopover` destroys the previous popover and creates a new one per step
   (`tour/step.ts:248-253`); `updatePopover()` reuses the wrapper (`popover.ts:237-250`).
3. `applyPopoverContent` touches only the elements in `PopoverDOM`; children added next to
   them survive `updatePopover()` (`popover.ts:182-221`).
4. `setConfig()` replaces the config without teardown; `drive()` reads `steps` from the config
   on every call (`driver.ts:402,532`). `setSteps()` tears down (`driver.ts:533-544`).
5. Hook order on a step change: `onDeselected(from)` → `onHighlightStarted(to)` → popover
   render (immediately, or at half the animation when animated) → `onHighlighted(to)`
   (`tour/highlight.ts:138-221`).
6. `destroy(reason)` with `onDestroyStarted` set returns before tearing down; a `destroy()`
   call from the hook runs `onDeselected` then `onDestroyed` with the original reason
   (`driver.ts:485-523`).
7. Next/Back buttons and ArrowRight/ArrowLeft call `onNextClick`/`onPrevClick` instead of
   moving when those hooks exist (`tour/step.ts:48-60`, `driver.ts:189-213,309-330`).
8. Focus: a new popover focuses Next if usable, else the wrapper (`popover.ts:316-330`); the
   Tab trap covers wrapper + target + allowed elements (`interaction/events.ts:29-67`); focus
   returns to the pre-tour element on destroy (`driver.ts:520-522`).
9. Keys are handled on `keyup` (`interaction/events.ts:84-104`).
10. `advanceOn` only listens for events whose path includes the active element
    (`tour/advance.ts:11-21`).
11. Progress placeholders are `{{current}}` and `{{total}}` (`tour/step.ts:19,66-70`).

---

## 4. Naming decision: our own public API, the engine's internal names kept

**Decision:** the public API uses VirtualTour's names (`createTour`, `TourConfig`,
`StepConfig`, `forward`/`backward`, `dim`, `spotlight`, `vt-*` classes). driver.js's public
surface (`driver()`, `Config`, `DriveStep`, `driver-*` classes, `moveNext`, `onHighlighted`,
…) is **not** exported and not kept compatible. Inside `src/engine/`, file names, function
names, and internal type names stay exactly as in driver.js.

Why not keep driver.js's public names:

- Two public vocabularies for one library doubles the docs, the types, and the test matrix,
  and the layered design already defined the VirtualTour API in full (§2). Dropping the
  driver.js surface removes a whole class of "which one should I use" questions.
- driver.js's names describe its model (one callback per hook, string-only content, a single
  `allowKeyboardControl`). The PRD's model (typed events, rich bodies, split switches,
  eligibility loop) does not map one-to-one, so a "compatible" surface would be compatible in
  name only.
- The class prefix must become configurable (T-10), so `driver-*` was going away regardless.

Why keep the engine's internal names: cherry-picking an upstream fix is a path rewrite plus a
rename of class strings; renaming internals would turn every cherry-pick into a hand port.
The `createEngine` rename is the one exception (the word "driver" would otherwise appear in
every stack trace integrators see).

Migration for driver.js users (`docs/migration/from-driverjs.md`, task V-14):

- An option-by-option table (`steps[].element` → `target`, `popover.title` → `title`,
  `popover.description` → `body`, `popover.side/align` → `placement`, `stagePadding` →
  `dim.padding`, `onHighlighted` → `step.on('shown')`, `moveNext` → `forward`, …).
- A class-name table (`driver-popover` → `vt-popover`, `driver-active-element` →
  `vt-target`, …) that a search-and-replace can apply to custom CSS.
- A list of what has no equivalent (`setConfig`/`getConfig`/`getState`, `highlight()` standalone, hints,
  checklists, the `when` predicate of `advanceOn`, `onInteraction`) with the recommended replacement;
  `setSteps` maps to `appendStep`/`dropStep` or a new tour.
- The default `namespace` is `vt`; it is not a compatibility switch (the suffixes differ
  too), and the docs say so.

---

## 5. Class names, data attributes, and the namespace (T-10, ST-4)

Two kinds of markers, decided in F-03:

1. **Mechanism attributes** (fixed, never configurable): the functional CSS in
   `engine.css` keys on these, so the shipped stylesheet is static and needs no runtime
   `<style>` injection (CSP-safe). `data-vt-active` and `data-vt-dim` on `<body>`,
   `data-vt-target`, `data-vt-blocked`, `data-vt-raised` on the target, `data-vt-extra` on
   extras, `data-vt-target-parent` and `data-vt-lock-scroll` on the parent, `data-vt-overlay`
   on the SVG, `data-vt-layer` on a `<dialog>` layer. The pointer-events rule
   (`driver.css:11-23`) becomes
   `[data-vt-active][data-vt-dim] :where(:not([data-vt-target], [data-vt-target] *, [data-vt-extra], [data-vt-extra] *, .vt-popover, .vt-popover *)) { pointer-events: none }`.
   Because it requires `data-vt-dim`, `dim: false` leaves the page interactive with no
   extra CSS.
2. **Styling classes and attributes** (prefixed by `namespace`, default `vt`): on page-owned
   elements the library adds `<ns>-active`, `<ns>-fade` / `<ns>-simple`, `<ns>-no-scroll`
   (body); `<ns>-target`, `<ns>-target-blocked`, `<ns>-target-raised`, `<ns>-spotlit`,
   `spotlight.class` (target); `<ns>-extra`, `<ns>-spotlit` (extras);
   `<ns>-target-parent` (parent); `<ns>-overlay` (SVG); `data-<ns>-step="<id>"` and
   `data-<ns>-side` (popover wrapper). Two tours with different namespaces can be styled
   independently by their own classes. No functional CSS references these.

The popover's own classes (`vt-popover`, `vt-popover-title`, `vt-popover-description`,
`vt-popover-footer`, `vt-popover-progress-text`, `vt-popover-prev-btn`,
`vt-popover-next-btn`, `vt-popover-close-btn`, `vt-popover-arrow`,
`vt-popover-arrow-side-*`, `vt-popover-side-*`, `vt-popover-align-*`,
`vt-popover-instruction`, `vt-popover-feedback`, `vt-popover-nudge`, `vt-popover-waiting`,
`vt-popover-done-btn`, `vt-popover-btn-disabled`) and the layer parts (`vt-body`,
`vt-footer`, `vt-button`, `vt-button--secondary`, `vt-no-arrow`, `vt-dialog`, `vt-speaker`,
`vt-bubble`, `vt-avatar`, `vt-bubble-tail`) are **not** namespaced, because the shipped
stylesheets must stay static. Multiple instances style their popovers through `classes` and
CSS variables. The ids `vt-popover-content`, `vt-popover-title`, `vt-popover-description`
stay fixed (one popover per page; N-10).

`core/namespace.ts` exports `names(ns)` returning every prefixed string once per engine
instance; no other file builds class names by string concatenation.

---

## 6. Data flow

```
createTour(config)
   │  normalize (config.ts): defaults, deep-merge stepDefaults (T-3), ids
   ▼
Tour ──owns──▶ TourStep[]  (no DOM, no engine instance yet)
   │
   │ start()                      compile.ts: TourConfig -> engine Config + DriveStep[]
   ▼                              (function-valued fields are evaluated lazily, per show)
createEngine(config + hooks)     (lazily, in the browser only)
   │
   │ start()/forward()/backward()/goTo()
   ▼
navigator.ts: next eligible index (shouldShow → resolve target + waitFor → whenMissing → prepare → revealWith)
   │
   ▼
engine.moveTo(i)  ──▶ onDeselected(prev) → onHighlightStarted(step) → render popover
                                   │
                                   ├─ presenter.mount(popoverDOM, step, parts)   (inside renderPopover, before positioning)
                                   ├─ engine positions, scrolls into view, focuses
                                   ├─ onReposition(info) → presenter.afterReposition  (now and after every scroll/resize refresh)
                                   └─ onHighlighted(step): presenter.afterShow, step `shown`, tour `step-shown`, promise resolves
```

Per-step values that were global in driver.js (`stagePadding`, `stageRadius`,
`popoverOffset`) are per-step `DriveStep` fields after V-02, read by `resolveStepPosition`
and `stageOptions`, so the layered design's "`setConfig` in `onWillShow`" trick is gone.

---

## 7. Lifecycle and event ordering contract

### 7.1 States

```
Tour:  idle ──start()──▶ running ──finish()/exit()──▶ idle
Step:  created ──show()──▶ shown ──hide()──▶ hidden ──show()──▶ shown ... ──dispose()──▶ disposed
```

### 7.2 Ordering (normative; each row is a unit test name in V-03)

| Situation | Engine hook(s) | Public events, in order |
|---|---|---|
| `start()` | `drive(i)` | registry `current = tour`; tour `started`; tour `activated`; then "show step S" |
| show step S | `onHighlightStarted(S)` → render → `onHighlighted(S)` | S `will-show` → presenter mounts → S `shown` → tour `step-shown` {step: S, previous} → the navigation promise resolves |
| navigate S → T | `onDeselected(S)` → `onHighlightStarted(T)` … | S `will-hide` → S `hidden` (back to back) → T `will-show` → … |
| S shown again later | same | S `will-show` → S `shown` (no `disposed`) |
| action step S completed | `onStepCompleted(S)` | S `completed` → tour `step-completed`; then, after `advanceDelay`, the engine calls `onNextClick` → navigator |
| `hideCurrent()` | `destroy()` with the `hiding` flag set | S `will-hide` → S `hidden`; no `exited`; tour stays `running`; the next navigation creates a fresh engine at the chosen index |
| `dropStep(S)` while S is visible | `setConfig({steps})` then `moveTo(j)` | S `will-hide` → S `hidden` → S `disposed` → show first remaining step; if none remain → `exit()` without prompt |
| `finish()` / Done on last step | `destroy()` reason `done` → `onDeselected(S)` → `onDestroyed` | S `will-hide` → S `hidden` → S `finished` → tour `finished` → every step `disposed` (array order) → registry `current = null` → tour `deactivated` |
| `exit()` accepted or no prompt | `destroy()` reason ≠ `done` | S `will-hide` → S `hidden` → S `exited` → tour `exited` {reason} → every step `disposed` → `current = null` → tour `deactivated` |
| Escape / close button / overlay click (`clickOutside: 'exit'`) | `onDestroyStarted(reason)` | the prompt runs; accepted → `destroy()` → as the `exit()` row; declined → nothing |
| `exit()` prompt declined | nothing | nothing emitted; returns `false` |
| forward past last step | `onDoneClick` → navigator | same as `finish()` (N-6) |
| backward before first step | `onPrevClick` → navigator | no-op; promise resolves |
| all remaining steps skipped moving forward | navigator loop | `finish()` (A-5) |
| all remaining steps skipped moving backward | navigator loop | `exit()` without prompt (A-5) |
| another tour starts while this one runs | engine `replaced` → `onDestroyed` | this tour: `exited` {reason: 'replaced'} sequence, no prompt (N-10) |
| `configure()` on a shown step | `updatePopover()` + `presenter.update` | no events |

Rules:

- `disposed` fires exactly once per step per run. Re-rendering never emits it.
- Registry relays each tour event after the tour's own listeners ran.
- Handlers run synchronously in subscription order; exceptions are caught, reported with
  `console.error` in dev, and do not break navigation.
- Navigation calls are serialized in `navigator.ts`: a `forward()` issued while a `prepare()`
  or `waitFor` is pending queues behind it (one pending navigation at most; a newer call
  replaces an older queued one). `exit()`/`finish()` abort any pending wait through an
  `AbortController`.
- `onDestroyStarted` receives reason `done` too (Done button, `driver.ts:197-199`); the layer
  never prompts for `done` or `replaced`.

### 7.3 Eligibility loop (A-5, A-6, A-7, A-9) in `navigator.ts`

For a candidate index `i` in direction `dir`:

1. `shouldShow?.()` false (or throws) → next candidate.
2. No `target` → eligible. Otherwise resolve (`dom/target.ts`); if missing and `waitFor > 0`,
   wait (MutationObserver on `document.documentElement`, `childList + subtree + attributes`,
   checked at most once per frame, plus a 250 ms poll, until found or timeout, abortable).
   While waiting, the current step stays visible with `aria-busy="true"` on its wrapper and the
   `vt-waiting` class. The engine's own `waitForElement` stays `0` because the lookup must
   happen before `prepare` (A-9).
   One navigation spends at most `waitBudget` ms (tour option, default 10000, `0` disables) waiting across consecutive
   steps; once spent, later steps are judged on what is on the page and follow `whenMissing`.
3. Still missing: `whenMissing === 'skip'` → next candidate; else eligible as centered (the
   compiled `DriveStep.element` is a function returning `null`, so the engine centers it); it stays centered until it is hidden, even when the target appears later.
4. `await prepare?.()` (A-7); exceptions are caught and reported; the step still shows. A hook that has not settled
   after `hookTimeout` (step option, default 10000 ms, `0` disables) is abandoned with a warning and the step shows, the
   same as for an exception; `revealWith` follows the same rule.
5. `revealWith?.(target)` awaited (SC-2) with the compiled step's `scrollIntoView: false`, so
   the engine does not scroll again; then `engine.moveTo(i)`.

End of candidates: forward → `finish()`; backward → `exit()` without prompt (A-5). The
engine's own `skipMissingElement` is also set for `whenMissing: 'skip'` steps so arrow keys
and `advanceOn` completions (which call `moveNext` inside the engine, `driver.ts:221-234`)
skip consistently; the navigator is authoritative for everything that routes through
`onNextClick/onPrevClick`.

---

## 8. Presenter extension point (native)

```ts
interface Presenter {
  mount(popover: PopoverDOM, step: TourStep, parts: StepParts): void; // called by the engine's renderPopover after options.onRender, before positioning
  afterShow(popover: PopoverDOM, step: TourStep): void;               // onHighlighted
  afterReposition(popover: PopoverDOM, step: TourStep, info: RepositionInfo): void; // engine onReposition, after every repositionPopover
  update(popover: PopoverDOM, step: TourStep, parts: StepParts): void; // configure()
  beforeLeave(step: TourStep): void;                                   // onDeselected
  unmount(): void;                                                     // tour end
  onNudge?(step: TourStep): void;                                      // popover nudged (gated Next, rejected gesture, tour.nudge())
  onCompleted?(step: TourStep): void;                                  // action step instruction met, before the step's `completed` event
  layout?: 'dialog' | 'speaker';                                        // which popover layout the engine builds (default 'dialog'); read after `ready()` settles
  ready?(): Promise<void>;                                              // awaited once before the first step of a run is built; a rejection is ignored; the run stops waiting after 10 s
}

interface StepParts {       // built by render/parts.ts
  body?: HTMLElement;       // `.vt-body`, only for non-string bodies (string bodies use the engine description)
  footer?: HTMLElement;     // `.vt-footer` with custom buttons
  buttons: HTMLButtonElement[];
  content?: Element | DocumentFragment; // what an element body resolved to; the presenter clones it into `.vt-body`
}

interface RepositionInfo {
  side: Side | 'over';   // the requested side when `pinned`
  align: Align;          // logical: in RTL, start is the physical right for top/bottom
  physicalAlign: 'left' | 'right' | 'top' | 'bottom' | 'center';
  rtl: boolean;
  pinned: boolean;       // no side fit: bottom-centre, arrow hidden
  wrapperRect: DOMRect; bubbleRect: DOMRect; targetRect: DOMRect | null;
}

interface PresenterContext {
  namespace: string;                      // the tour's `namespace`
  sanitize?: (html: string) => string;    // the tour's memoized `sanitize`
  fadeMs: number;                         // entrance fade: `dim.transitionMs`, or 0 when `animate` is off
}

type PresenterFactory = (tour: Tour, context: PresenterContext) => Presenter;
```

The engine knows about presenters only through these calls (V-02): `renderPopover` calls
`presenter.mount` right after `options.onRender` (`popover.ts:303`), `repositionPopover`
returns the rendered side and alignment and the engine passes them to `onReposition`, and
`createPopover(layout)` builds the speaker structure when asked (A-04). There is no
MutationObserver on the wrapper and no "move the engine's parts into a bubble" step any more.

`DialogPresenter` (default) adds `vt-dialog` to the wrapper and appends the layer parts. `DialogPresenter` renders the custom
footer through `syncFooter` (`render/buttons.ts`, internal and not exported from any entry), on
`mount` and again on `update`; a presenter that supports `buttons` has to do the equivalent.
`withAvatar(...)` returns a factory for `SpeakerPresenter` (`02-avatar.md`). The core bundle
never imports avatar code.

Layer parts are always added next to the engine's elements, never replacing them, so
`updatePopover()` keeps working:

- string body → engine `description` (through `sanitize`); non-string body → `.vt-body`
  inserted after `vt-popover-description`, and `aria-describedby` repointed to it.
- custom buttons → `.vt-footer` inserted after `vt-popover-footer`; the engine's own Next/Back
  are hidden through `showButtons: ['close']`.
- `closeButton.attrs` applied to `popover.closeButton` through the attribute guard (§11).

---

## 9. Focus and keyboard (X-2, X-3, X-4)

All of it is engine code (§3.2 items 8 and 9) except:

- `focus: 'first-button'` → the presenter focuses the first enabled custom button in
  `afterShow`.
- Accessible name (X-1, S-3) is engine code after V-05: `popover.label` sets `aria-label`
  and removes `aria-labelledby` when there is no title; neither → the dialog is unnamed and
  the dev build warns once.
- `keys.escape` / `keys.arrows` compile to engine `allowEscape` / `allowArrowKeys` (V-02).
- Right-to-left pages: ArrowRight always means forward and ArrowLeft always means backward
  (physical keys, `interaction/events.ts:99-103`). Owner decision 2026-11-12. RTL mirroring
  (F-08) touches positioning only.
- Focus ring: `theme.css` styles `:focus-visible` on the wrapper and on `.vt-button`.

---

## 10. SSR safety (NF-ssr)

- No module touches `window`, `document`, `navigator`, `matchMedia`, `localStorage`, or
  `requestAnimationFrame` at import time. The engine already meets this (no top-level DOM
  use in `src/`); the SSR gate (F-01) imports every entry with `window` deleted and fails on
  the first regression.
- `createTour()` may be called on the server; `start()` on the server throws
  `TourEnvironmentError`.

---

## 11. Security (NF-security)

- No `eval`, `new Function`, or string-to-code. JSON tours resolve handler names from an
  explicit `handlers` map only.
- The engine sets `title`, `description`, `instruction`, and `feedback` with `innerHTML`
  (`popover.ts:73-80`). `TourConfig.sanitize` runs on every HTML string before it reaches
  the engine, and the docs say strings are otherwise unsanitized (S-2).
- `attrs` on buttons and the close button cannot override `type`, `class`, `aria-label`,
  `id`, or any `on*` attribute (S-4); names starting with `on` are dropped.
- No runtime `<style>` injection (§5), so strict CSP needs no `style-src` exception beyond
  what inline `style` properties set through the CSSOM already allow.

---

## 12. Tracking upstream after the fork

### 12.1 Policy

- The fork point is tag `1.12.1` (commit `0163642dc532417ea401684bd26690e2f3283d63`),
  recorded in `NOTICE.md` and `UPSTREAM.md`.
- **Nothing in this plan waits for upstream.** Every feature lands in `src/engine/` directly.
- **Review cadence:** on every upstream release, and at least once a quarter, a maintainer
  reads the upstream changelog (`apps/docs/src/content/guides/changelog.mdx` in the upstream
  repository) and records the review in `UPSTREAM.md` (version, date, verdict per entry).
- **What to cherry-pick:** security fixes and bug fixes in code the fork still shares
  (anything under `src/engine/` whose logic we did not rewrite). New upstream features are
  not adopted by default; a maintainer may open a task for one if the PRD or users want it.
- **What to ignore:** changes to hints, checklists, the Astro playground, the docs site, and
  the tsdown build.
- **Giving back:** a fix we make that applies to upstream may be offered as a pull request as
  goodwill. It never blocks anything here, and the fork does not change when upstream merges
  it. Upstream has no `CONTRIBUTING` file and no CLA at the fork point (CONFIRMED: the
  repository root and `.github/` hold only `FUNDING.yml`, `images/`, `workflows/ci.yml`).

### 12.2 Mechanics

- Add the upstream repository as a git remote named `upstream`; fetch tags only when
  reviewing.
- Cherry-pick with a path rewrite, because upstream paths are `packages/driver/src/<file>`
  and ours are `packages/core/src/engine/<file>`:
  `git format-patch -1 <sha> --stdout | git apply -p4 --directory=packages/core/src/engine --3way`
  (`-p4` strips `a/packages/driver/src/`; `--directory` prepends ours). `tools/upstream-apply.mjs`
  (V-16) wraps this, rewrites `driver-` class strings to `vt-` through `core/namespace.ts`'s
  table, and refuses hunks that touch removed files (hints, checklist).
- Every cherry-pick commit message carries `Upstream: <sha>` and the upstream version.
- After a cherry-pick: run the ported engine suite (`test/engine/**`, `e2e/engine/**`) first,
  then the whole suite.

### 12.3 What makes cherry-picks stay cheap

- Internal names kept (§4).
- Class and attribute names come from one table (`core/namespace.ts`), so a hunk that adds a
  class name needs one line in the table, not a search across files.
- Engine files import nothing from outside `src/engine/` (§3).
- `UPSTREAM.md` lists, per engine file, which fork tasks changed it (the table in §3), so a
  reviewer knows at a glance where a hunk will conflict.

---

## 13. Bundle size (NF-size)

The owner set **about 21 KB min+gzip for the core entry as a soft target; larger is
acceptable when needed** (2026-11-12). The size report runs in CI and **warns only**:

| Entry | Soft target (min+gzip) | Starting point |
|---|---|---|
| `.` (engine + public API) | ≈ 21 KB JS, ≈ 3 KB CSS | driver.js 1.12.1 core: 14.1 KB JS + 1.9 KB CSS (hints and checklists removed) |
| `./avatar` | ≈ 6 KB | excluding the Thumbtack assets |
| `./motion` | ≈ 2 KB | |
| wrappers | ≈ 2 KB each | |

`tools/size-report.mjs` prints every entry, the delta against the last recorded report
(`SIZE.md`, updated on milestone-closing tasks), and a warning line above a target. It
never exits non-zero. A PR that grows an entry by more than 10 % says why in its description.

---

## 14. Browser support (D-7)

Last two versions of Chrome, Edge, Firefox, Safari (ES2020 target, as upstream). Features
relied on: `MutationObserver`, `ResizeObserver`, CSS custom properties, `:focus-visible`,
`prefers-reduced-motion`, `popover` attribute for `<dialog>` layering (feature-detected in
`layerFor`, `core/utils.ts:156`). No polyfills shipped. Tours inside shadow roots or iframes
are not supported in v1 (owner decision 2026-11-12); `mountIn` must be an element in the
light DOM of the document the tour runs in, and the docs say so.
