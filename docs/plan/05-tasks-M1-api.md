# 05. Milestone 1: the public API on the engine

Outcome: a tour runs end to end through VirtualTour's public API with typed events,
promises, the eligibility loop, rich content and buttons, the step instance API, and action
steps. Every engine seam the public layer needs is a direct source change in
`src/engine/`, not a workaround.

Tasks: V-01 → V-02 → V-03 are sequential; V-04, V-05, V-06 need V-03 and can run in
parallel.

Rule for this milestone: files outside `src/engine/` may import engine modules; engine
files never import from outside `src/engine/` (`01-architecture.md` §3).

---

## V-01 Config model, deep merge, ids, typed emitter, and the compiler

**Goal.** Turn a `TourConfig` into a fully defaulted internal config, and compile it (pure)
into the engine's `Config` + `DriveStep[]`, including the per-step fields the engine gains
in V-02 and the M2 tasks.

**PRD requirements covered.** T-1, T-3, T-4, T-10 (option plumbing), S-7, section 3.10
"Event API" (emitter), A-8 (wait/skip stay plain values).

**Files in the fork.** `src/config.ts`, `src/events.ts`, `src/compile.ts`,
`src/internal.ts` (exports for tests), `test/config.test.ts`, `test/events.test.ts`,
`test/compile.node.test.ts`.

**Public API added.**
```ts
class Emitter<Events extends Record<string, unknown>> {
  on<E extends keyof Events>(e: E, fn: (p: Events[E]) => void, ctx?: object): () => void;
  once<E extends keyof Events>(e: E, fn: (p: Events[E]) => void, ctx?: object): () => void;
  off<E extends keyof Events>(e?: E, fn?: (p: Events[E]) => void): void;
  emit<E extends keyof Events>(e: E, payload: Events[E]): void;   // internal
}
// internal
function normalizeTourConfig(c: TourConfig): NormalizedTourConfig;
function mergeStepConfig(base: Partial<StepConfig>, patch: Partial<StepConfig>): StepConfig;
function makeTourId(name?: string): string;
function compileTour(c: NormalizedTourConfig, steps: TourStep[]): CompiledTour;
interface CompiledTour {
  base: EngineConfig;                 // engine Config without hooks (Tour adds them)
  steps: DriveStep[];                 // one per TourStep, data: { vt: step }, with per-step fields
}
function compileStepForShow(step: TourStep): DriveStep;  // evaluates function-valued fields
```

Deep-merge rule: plain objects in `position`, `spotlight`, `keys`, `dim`, `closeButton`
(object form), `position.offset` (object form), `spotlight.radius`/`dim.radius` (corner
form), and `extensions.*` merge recursively; arrays (`buttons`, `classes`,
`spotlight.extra`) replace; functions and DOM elements replace. `undefined` in a patch does
not delete.

Defaults (single source of truth): `namespace: 'vt'`, `keys: { escape: true, arrows: true }`,
`exitPrompt: false`, `dim: false`, `counter: false`, `animate: true`,
`labels: { next: 'Next', back: 'Back', done: 'Done', close: 'Close' }`, step
`whenMissing: 'center'`, `closeButton: true`, `focus: 'dialog'`, `reveal: true`,
`position: { offset: { main: 10, cross: 0 }, viewportPadding: 0, flip: true, shift: true,
strategy: 'fixed', arrow: { minInset: 15 } }`, `spotlight: { extra: [], targetInteractive: true }`,
`dim` object defaults `{ padding: 10, radius: 5, transitionMs: 400, color: '#000',
opacity: 0.7, clickOutside: 'none', pageScroll: true, lockScrollParent: false,
clipToScrollParents: true }` (the engine's own defaults where they exist,
`core/context.ts:44-65`, so `dim: true` looks like plain driver.js).

Compile rules: the table in `03-schemas.md` §1.4. Fields whose engine support arrives in
M2 (`popoverCrossOffset`, `popoverPadding`, `flip`, `shift`, `strategy`, `arrowMinInset`,
`side: 'auto' | 'over'`, corner radius, `scrollIntoView`, `mountIn`, `lockScrollParent`,
`clipStageToScrollParents`) are compiled now and typed as optional engine fields; the
engine ignores unknown keys until the matching task reads them, and each M2 task deletes
its "ignored until" note from the `03-schemas.md` table.

**Tests/proof required.** Unit: nested merge of `position` keeps unspecified keys; corner
radius merges per corner; array replace; function replace; `name` feeds the id; ids unique
across 10 000 calls; emitter order, `once`, `off` variants, `ctx`, throwing handler reported
and others still run; `compileTour` is pure (same input → deep-equal output, no DOM globals
in the node project); every row of `03-schemas.md` §1.4 has a named test; `dim:false` →
`overlay: false`; `whenMissing:'skip'` → `skipMissingElement:true`; a step with `buttons` →
`showButtons: ['close']`; `closeButton:false` → `showButtons` without `'close'`;
`placement` absent with a target → `side: 'over'`; `placement: 'auto'` → `side: 'auto'`;
`reveal: 'smooth'` → `scrollIntoView: { behavior: 'smooth' }`; `revealWith` set →
`scrollIntoView: false`.

**Acceptance criteria.** `compile.ts` and `config.ts` import only types from
`src/engine/types.ts` (`import type`), never values; the node test project enforces no DOM
globals.

**Depends on.** F-03.

---

## V-02 Engine seams for the public API

**Goal.** Make the direct engine changes the public layer needs so no hook-level workaround
survives from the layered design: split keyboard switches, per-step overlay and offset
values, an overlay off switch, the presenter calls, the reposition callback, and the body
`data-vt-dim` marker.

**PRD requirements covered.** T-5 (overlay off), T-7, T-8, H-2 (per-step padding/radius),
P-2 (per-step offset), section 3.11 (presenter update seam).

**Files in the fork.**
- `src/engine/types.ts`: `Config.allowEscape?: boolean`, `Config.allowArrowKeys?: boolean`
  (both default `true`; `allowKeyboardControl` stays as a deprecated alias that sets both),
  `Config.overlay?: boolean` (default `true`), `Config.presenter?: EnginePresenter`,
  `Config.onReposition?: (info: RepositionInfo, opts: HookOpts) => void`,
  `DriveStep.stagePadding?`, `DriveStep.stageRadius?`, `DriveStep.popoverOffset?`.
  `EnginePresenter` is the engine-side view of `Presenter`: `{ layout?: 'dialog' | 'speaker';
  mount(popover: PopoverDOM, step: DriveStep): void; afterReposition?(info): void }` — the
  public `Presenter` methods that need `TourStep` are wrapped by `Tour`.
- `src/engine/interaction/events.ts:84-104`: `onKeyup` checks `allowEscape` for Escape and
  `allowArrowKeys` for the arrows; `allowKeyboardControl === false` still disables both.
- `src/engine/driver.ts:376-395` `init()`: adds `data-vt-dim` to `<body>` only when
  `overlay !== false`; `removeTour` clears it. `src/engine/tour/highlight.ts:69-77` and
  `overlay/overlay.ts:116-132`: when `overlay === false`, no SVG is mounted, no tween runs
  (`transferHighlight` skips `transitionStage` and calls `trackActiveElement` with a no-op
  overlay), and the popover is still positioned and the target still marked.
- `src/engine/overlay/overlay.ts:143-153` `stageOptions`: reads `stepOption(ctx, step,
  "stagePadding")` / `"stageRadius"` (per step, falling back to config).
  `src/engine/tour/step.ts:164-174` `resolveStepPosition`: per-step `popoverOffset` and
  `stagePadding`.
- `src/engine/popover/popover.ts:303`: after `options.onRender?.(popover)`, call
  `options.presenter?.mount(popover, step)`; `PopoverRenderOptions` gains `presenter` and
  `step`; `tour/step.ts:204-246` passes them through. `updatePopoverContent` (237-250)
  does **not** call `mount` (the public `configure()` calls `presenter.update` itself).
- `src/engine/popover/position.ts:55-174` `repositionPopover` returns
  `{ side: Placement; align: Alignment; wrapperRect: DOMRect; targetRect: DOMRect | null }`;
  `tour/step.ts` `repositionStepPopover` and `renderStepPopover` pass the result to
  `ctx.getConfig("onReposition")` (and the presenter's `afterReposition`).
- `src/engine/core/context.ts`: defaults for the new keys.
- Ported tests updated where the keyboard switch changed; new engine tests listed below.
- `test/fixtures/fork-point.sha256` regenerated.

**Public API added.** None directly (V-01 already compiles to these fields; V-03 wires the
hooks).

**Tests/proof required.**
- Unit `test/engine/keys-split.test.ts`: `allowEscape: false` ignores Escape while
  ArrowRight moves; `allowArrowKeys: false` ignores arrows while Escape destroys;
  `allowKeyboardControl: false` ignores all three; defaults unchanged from upstream.
- Unit `test/engine/overlay-off.test.ts`: `overlay: false` → no `[data-vt-overlay]` in the
  DOM, `<body>` has `data-vt-active` and not `data-vt-dim`, the target has `data-vt-target`,
  the popover is positioned (`style.left` is a px value after `nextFrame`); a page button
  outside the tour is clickable (jsdom `click` dispatch reaches its listener; the real
  pointer check is in V-07's e2e).
- Unit `test/engine/per-step-stage.test.ts`: two steps with different `stagePadding` yield
  overlay paths whose cut-out sizes differ by the padding delta; per-step `popoverOffset`
  changes the computed `offset` passed to `repositionPopover` (spy).
- Unit `test/engine/presenter-seam.test.ts`: `presenter.mount` runs after content is applied
  and before `style.left` is set; `onReposition` fires once per render and once per
  `refresh()` with the rendered side.
- The whole ported suite stays green.

**Acceptance criteria.** No `setConfig` call is needed to change padding, radius, or offset
between steps (grep in `src/` outside `engine/` for `setConfig` finds only `replaceSteps`).

**Depends on.** V-01.

---

## V-03 Tour runtime: lifecycle, navigation, events, registry, exit prompt

**Goal.** `Tour`, `TourStep`, `tours`: start, forward, backward, goTo, exit (with prompt),
finish, hideCurrent, add/remove steps while running, teardown, promises that resolve on
`shown`, and the event order of `01-architecture.md` §7.2, wired directly to the engine's
hooks.

**PRD requirements covered.** T-1, T-2, T-5 (overlay on/off wiring), T-7, T-8, T-9, N-1,
N-2, N-3, N-4 (without the wait case), N-5, N-6, N-7, N-8, N-9, N-10, N-11, section 3.10
(tour, step, registry events and ordering), section 3.11 (`show/hide/exit/finish/dispose`).

**Files in the fork.** `src/tour.ts`, `src/step.ts`, `src/registry.ts`, `src/navigator.ts`
(skeleton: index selection and serialization only; eligibility rules arrive in V-04),
`src/presenter.ts` (`DialogPresenter` skeleton), `src/index.ts`, `test/lifecycle.test.ts`,
`test/registry.test.ts`, `test/tour-model.test.ts`, `test/engine/invariants.test.ts`
(the 11 facts of `01-architecture.md` §3.2 as plain tests), `e2e/navigation.spec.ts`,
`demo/fixtures/navigation.html`.

**Public API added.** `createTour`, `Tour` (everything in `01-architecture.md` §2.3 except
`progressInfo`, `advance`, `nudge`), `TourStep` (§2.4 except `configure`), `tours`, types
`TourConfig`, `StepConfig`, `TourEvents`, `StepEvents`, `TourEnvironmentError`,
`TourNavigationError`.

Behavior details:
- `start()`: throws `TourEnvironmentError` without a DOM; when already running resolves
  with no events; creates the engine (`createEngine({ ...compiled.base, ...hooks })`), sets
  `tours.current`, emits `started`, `activated`, then navigates to the first eligible index.
  The engine tears down any other active instance itself (`replaced`); the registry turns
  that into the other tour's `exited {reason:'replaced'}` sequence.
- The hook → event mapping is the table in `01-architecture.md` §3.1 and §7.2. `onNextClick`
  / `onPrevClick` / `onDoneClick` call `navigator.forward()` / `backward()`;
  `onDestroyStarted(reason)` runs the prompt for `close | escape | overlay`, calls
  `engine.destroy()` when accepted, does nothing when declined; for `done` it calls
  `engine.destroy()` at once; for `replaced` the layer gets `onDestroyed` only.
- `exit()`: runs the prompt itself (`string` → `window.confirm`; function → awaited), then
  `engine.destroy()`; returns `false` without events when declined.
- `finish()`: `engine.destroy()` after setting the layer's `endReason = 'done'` so
  `onDestroyed` (which reports `api`) is mapped to `finished`.
- `hideCurrent()`: sets `hiding = true`, `engine.destroy()`; the `onDestroyed` handler
  emits only `will-hide`/`hidden`; the next navigation creates a fresh engine and
  `drive(index)`s it.
- `appendStep` / `dropStep` while running: recompile `steps`, `engine.setConfig({
  ...engine.getConfig(), steps })` (never `setSteps`, invariant 4); dropping the visible step:
  `will-hide`, `hidden`, `disposed`, then `moveTo` the first remaining index or `exit()`
  without prompt.
- Teardown on end (N-11): dispose every step (`element = null`, presenter `unmount`),
  `tours.current = null`, `deactivated`; the engine instance is dropped (a new run creates a
  new one).
- Presenter: `DialogPresenter` with only `mount` adding `vt-dialog` and `data-<ns>-step` to
  the wrapper (content parts come in V-05).

**Tests/proof required.**
- Unit `lifecycle.test.ts` (jsdom, real engine, `animate:false`): a recorder subscribes to
  every tour, step, registry event and asserts the exact sequence for each row of
  `01-architecture.md` §7.2 (start; forward; backward; goTo; shown again has no `disposed`;
  hideCurrent then forward; dropStep visible; finish; exit accepted; exit declined; Escape
  with prompt declined; forward past last; backward before first; start while running;
  second tour while one runs → `replaced`). Also: handler exception does not stop
  navigation; `once` on `step-shown`; promises resolve after `shown` (the DOM has the
  wrapper when the promise resolves); `keys.escape:false` ignores Escape while arrows work;
  `keys.arrows:false` ignores ArrowRight while Escape works.
- Unit `tour-model.test.ts`: steps created eagerly without DOM; `appendStep` at end, at
  index, before an id; `dropStep` by id and by instance; `stepById`; `createTour` is the
  default export.
- Unit `test/engine/invariants.test.ts`: one test per fact in `01-architecture.md` §3.2,
  named by its number and sentence.
- e2e `navigation.spec.ts` (3 browsers): forward/backward through 3 steps asserting
  `data-vt-step` on `.vt-popover`; arrow keys; Escape with `exitPrompt` string uses the
  native confirm (`page.on('dialog')`): decline keeps the tour open, accept removes the
  popover and overlay from the DOM; after exit, focus is back on the start button.

**Acceptance criteria.** The §7.2 table rows are reproduced verbatim as test names; only
`src/tour.ts` imports a value from `src/engine/driver.ts` (a unit test greps `src/`
outside `engine/`).

**Depends on.** V-02.

---

## V-04 Eligibility loop: conditional steps, wait, skip, prepare, reveal, auto-advance

**Goal.** Complete `navigator.ts`: `shouldShow`, lazy target resolution with `waitFor`,
`whenMissing`, `prepare`, `revealWith`, the all-skipped outcomes, navigation serialization,
and `autoAdvance` (target case through the engine, selector case through the layer).

**PRD requirements covered.** A-1, A-2, A-4, A-5, A-6, A-7, A-8, A-9, N-4 (wait case),
SC-2, AD-1, AD-2.

**Files in the fork.** `src/navigator.ts`, `src/dom/target.ts` (`resolveTarget`,
`waitForTarget(ref, ms, signal)`), `src/advance/auto-advance.ts`, `src/step.ts`
(`resolvedTarget`), `test/navigator.test.ts`, `test/dom/wait.test.ts`,
`test/advance.test.ts`, `e2e/eligibility.spec.ts`, `e2e/auto-advance.spec.ts`,
`demo/fixtures/late-target.html`, `demo/fixtures/skip.html`, `demo/fixtures/prepare.html`,
`demo/fixtures/auto-advance.html`, `docs/cookbook/advancing-programmatically.md` (stub).

**Public API added.** `StepConfig.target`, `placement`, `waitFor`, `whenMissing`,
`shouldShow`, `prepare`, `revealWith`, `autoAdvance`, `TourStep.resolvedTarget`.

Rules: `01-architecture.md` §7.3. `waitForTarget`: MutationObserver on
`document.documentElement` (`childList`, `subtree`, `attributes`), checks at most once per
frame, plus a 250 ms poll; first hit wins; `AbortSignal` cancels both. While waiting the
current popover gets `vt-waiting` and `aria-busy="true"`; the pending promise stays
pending. `shouldShow` exceptions count as `false`; `prepare` exceptions are reported and the
step still shows. `revealWith` runs before `moveTo` and the compiled step carries
`scrollIntoView: false` (F-11) so the engine does not scroll a second time; until F-11
lands the engine's own `bringInView` is a no-op when the element is already in view
(`core/utils.ts:73-76`), which the test relies on. `autoAdvance.selector`: one
capture-phase `document` listener per shown step matching `event.target.closest(selector)`,
calls `tour.forward()` once, removed on leave; without `selector` the compiled step carries
`advanceOn` (with `strict` when set).

**Tests/proof required.**
- Unit (jsdom, fake timers): `shouldShow` false skips; order of a spy log is `lookup`,
  `prepare`, `will-show`; a `prepare` that creates the target cannot rescue a `skip` step
  (A-9); wait resolves via observer, via poll with the observer stubbed, times out, aborts
  with `vi.getTimerCount() === 0`; forward over two missing-skip steps lands on the third;
  all remaining skipped forward → `finished` sequence; backward with all previous skipped →
  `exited` with no prompt (`exitPrompt` function not called); a targetless step is never
  skipped; `forward()` during a pending `prepare` queues; two calls queue one move;
  `exit()` during `prepare` ends the tour and the prepared step never shows; selector
  auto-advance fires once and survives `stopPropagation`; target auto-advance is compiled
  to `advanceOn`.
- e2e (3 browsers): target inserted after 800 ms with `waitFor: 3000` attaches within 1 s
  and `start()` resolves after attachment; never inserted with `waitFor: 500` centers after
  about 500 ms, and with `whenMissing: 'skip'` is skipped; the `prepare` panel fixture
  shows step 2 centered (documented gotcha) while the cookbook alternative attaches;
  clicking the real Save advances; `event: 'input'` advances; `tours.current?.forward()`
  from a page button works (AD-2).

**Acceptance criteria.** No timers or observers remain after the tour ends (unit count plus
an e2e test hook counting live observers); each rule in A-5 maps to one named test.

**Depends on.** V-03.

---

## V-05 Step content, buttons, counter, accessible name, and the step instance API

**Goal.** Render VirtualTour's content model into the engine's popover: titles and bodies
of every allowed type, the accessible label (as an engine feature), close-button
attributes, custom buttons with actions, the counter (including custom functions),
classes; and `configure()` / `element` semantics.

**PRD requirements covered.** S-1, S-2, S-3, S-4, S-5, S-6, B-1, B-2, B-3, B-4, B-5,
X-1 (name), V1X-counter, section 3.15 (built-in part), section 3.11 (`configure`,
`element`, `isShown`), NF-security (sanitizer hook, attribute guard).

**Files in the fork.**
- Engine (was upstream task U-06): `src/engine/types.ts` `Popover.label?: string` and
  `PopoverPatch` includes it; `src/engine/popover/popover.ts` `applyPopoverContent`
  (182-221): when `title` is empty remove `aria-labelledby` and set `aria-label` to
  `options.label` when present (remove `aria-label` otherwise); when `title` is present set
  `aria-labelledby` back. The attribute moves from `renderPopover` (268) into
  `applyPopoverContent` so `updatePopover()` keeps it right. The placeholder texts
  "Popover Title" (378-380) and "Popover description is here" (383-384) become empty
  strings. `src/engine/tour/step.ts` `resolveStepPopover` passes `label` through;
  `PopoverRenderOptions` gains `label?: string`.
- Public layer: `src/presenter.ts` (full `DialogPresenter`), `src/render/parts.ts`,
  `src/render/content.ts`, `src/render/buttons.ts`, `src/step.ts` (`configure`),
  `src/tour.ts` (`progressInfo`), `test/render/*.test.ts`, `test/step-api.test.ts`,
  `test/counter.test.ts`, `test/engine/aria-label.test.ts`, `e2e/content.spec.ts`,
  `e2e/configure.spec.ts`, `demo/fixtures/content.html`.

**Public API added.** `Presenter`, `StepParts`, `PresenterFactory`, `RepositionInfo`
types; `TourConfig.presenter`, `TourConfig.sanitize`, `TourConfig.counter`,
`TourConfig.labels`; `StepConfig` fields `title`, `body`, `label`, `closeButton`,
`classes`, `meta`, `buttons`, `focus`; `ButtonConfig`; `TourStep.configure`,
`Tour.progressInfo()`.

Rendering rules (`01-architecture.md` §8):
- Title → engine `popover.title` (string after `sanitize`); functions evaluated at show
  time (S-1, B-3).
- Body: string → `description` after `sanitize`; `string[]` → one `<p>` per string, joined,
  as `description`; `Element` → appended into `.vt-body` (moved, not cloned; documented)
  inserted after `vt-popover-description`, `aria-describedby` repointed to the `.vt-body`
  id; function → evaluated at show time and handled by its result type (S-2).
- Accessible name: engine code now. Title → `aria-labelledby`; no title + `label` →
  `aria-label`; neither → unnamed and a one-time dev warning from `Tour` (S-3, X-1).
- Close button: the engine's own (`showButtons` includes `close`); `label` → `closeBtnLabel`;
  `attrs` applied with the guard (`type`, `class`, `id`, `aria-label`, `on*` dropped) (S-4).
- Buttons (B-1..B-5): `.vt-footer` after `vt-popover-footer` holding
  `<button type="button" class="vt-button [vt-button--secondary] [classes]">`, `aria-label`
  from `label`, `disabled` resolved at show time, `attrs` guarded; `action` strings call
  `tour.forward/backward/exit/finish`; a function action gets `{ tour, step }`. The engine's
  next/back are hidden (`showButtons: ['close']`) when `buttons` is set.
- `focus: 'first-button'` → focus the first enabled `.vt-button` in `afterShow`.
- `classes` → `popoverClass` (space-joined) so the engine manages them (`popover.ts:216-220`).
- Counter: `counter: true` → `showProgress: true` with the engine's default
  `{{current}} of {{total}}`; a function → `showProgress: true` and `popover.progressText`
  set per step to the function's output (no placeholders). `progressInfo()` returns the
  1-based index in `tour.steps` and `steps.length`. Skipped steps still count (owner
  decision 2026-11-12; `12-risks-open-questions.md` §2).
- `configure(patch)`: merge; if shown, `engine.updatePopover({ title, description, label,
  popoverClass, progressText, instruction })` plus `presenter.update()` for layer parts; no
  events.
- `element` is `undefined` before the first show, the wrapper while shown and after hide,
  `null` after dispose.

**Tests/proof required.**
- Unit engine `aria-label.test.ts`: no title + `label` → `aria-label` set, no
  `aria-labelledby`; title → `aria-labelledby` and no `aria-label`; `updatePopover({ title:
  '', label: 'x' })` switches at runtime; the title element's text is empty when hidden.
- Unit public (jsdom, real engine): each body type; sanitizer called once per HTML string;
  attribute guard drops protected keys and `onclick`; disabled fn; secondary variant;
  action mapping calls the tour method; function action payload; counter text for `true`
  and for a function; updates after `appendStep` while shown; `configure` on a shown step
  replaces title/body/buttons in place with no lifecycle events and the same wrapper
  element; `element` truth table.
- e2e `content.spec.ts` (3 browsers): a step with title, Element body, two custom buttons
  and a close button renders inside `.vt-popover`; Tab order is close → custom buttons (the
  engine's trap covers the layer's buttons); `getByRole('dialog', { name })` resolves to the
  title for a titled step and to `label` for an untitled one. `configure.spec.ts`: body and
  button text change in place, wrapper identity unchanged, focus stays inside.

**Acceptance criteria.** Layer parts are added next to the engine's elements, never
replacing them: `updatePopover()` after `mount` keeps every `.vt-*` element (unit test); no
inline styles on layer parts.

**Depends on.** V-03.

---

## V-06 Action steps in the public API

**Goal.** Expose the engine's action-step model (`instruction`, `advanceDelay`, nudge,
advance, completion) as first-class public API, events, and JSON fields, with the avatar
hook points it needs.

**PRD requirements covered.** AD-1 (strict gesture), AD-2 (programmatic completion),
section 3.10 (new `completed` events), owner decision 3 (2026-11-12).

**Files in the fork.**
- Engine: `src/engine/types.ts` `Config.onStepCompleted?: DriverHook`;
  `src/engine/tour/completion.ts` calls it right after it marks the activation done and
  before any `advanceDelay` timer; `src/engine/tour/nudge.ts` exports a `onNudge` hook call
  (`Config.onNudge?: (step) => void`) so the avatar can react to engine-initiated nudges
  (Next pressed on an unmet action step, `driver.ts:128-139`).
- Public: `src/tour.ts` (`advance()`, `nudge(message?)`, `step-completed` event),
  `src/step.ts` (`completed` event), `src/compile.ts` (`instruction` → `popover.instruction`
  through `sanitize`; `advanceDelay`; `autoAdvance.strict`), `src/presenter.ts`
  (`Presenter.onNudge?(step)` and `onCompleted?(step)` optional members), `src/json/`
  placeholder note for V-11, `test/action-steps.test.ts`, `e2e/action-steps.spec.ts`,
  `demo/fixtures/action-steps.html`, `docs/guide/action-steps.md` (stub).

**Public API added.** `StepConfig.instruction`, `StepConfig.advanceDelay`,
`StepConfig.autoAdvance.strict`, `Tour.advance()`, `Tour.nudge(message?)`,
`TourEvents['step-completed']`, `StepEvents.completed`, `Presenter.onNudge`,
`Presenter.onCompleted`.

Rules: a step with `instruction` is gated: the engine disables Next until `advanceOn` fires
or `tour.advance()` runs (`tour/step.ts:148-150`, `driver.ts:262-269`); pressing Next,
ArrowRight, or the overlay while gated nudges (`driver.ts:128-139,161-187,323-330`); after
completion the engine waits `advanceDelay` ms (showing the done state) and then calls
`onNextClick`, which routes through the navigator like any Next. `tour.nudge(text)` calls
`engine.nudge(text)` (shows the feedback row and shakes; flash under reduced motion,
`driver.css:118-128`). The layer emits `completed` from `onStepCompleted`. The avatar
presenter plays `alert` on nudge and `celebrate` on completion (A-05). Custom `buttons`
with `action: 'forward'` on a gated step call `tour.forward()`, which the navigator routes
through the engine's `pressNext` so the gate applies (the engine's `pressNext` is reached
through `engine.getState('__activation')` checks in `navigator.forward()`: if the current
step is an unmet action step, call `engine.nudge()` instead of moving).

**Tests/proof required.**
- Unit (jsdom, real engine): `instruction` renders the instruction row inside the popover;
  Next is `aria-disabled` while unmet; `tour.forward()` on an unmet step nudges and does
  not move; `advance()` completes, emits `completed` then `step-completed`, and after
  `advanceDelay` (fake timers) moves to the next step through the navigator (a `shouldShow:
  false` next step is skipped, proving the route); `autoAdvance: { event: 'click', strict:
  true }` completes on a click and ignores `pointerdown`; `nudge('text')` shows the feedback
  text and the presenter's `onNudge` is called; `instruction` as a function is evaluated at
  show time and sanitized.
- e2e (3 browsers): the action-steps fixture: pressing Next on the gated step shakes the
  popover (the `vt-popover-nudge` class appears and is removed within 1 s); clicking the
  real target completes and after 600 ms the next step shows; with
  `reducedMotion: 'reduce'` the nudge shows the flash, not the shake
  (`document.getAnimations()` holds no transform animation).

**Acceptance criteria.** The engine's own `tests/tour/action-steps.test.ts`,
`instruction.test.ts`, `nudge.test.ts` (ported in F-02) stay green; `docs/guide/action-steps.md`
stub lists every public member added here.

**Depends on.** V-05.
