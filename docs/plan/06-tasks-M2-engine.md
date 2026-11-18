# 06. Milestone 2: engine features

Outcome: every PRD positioning, overlay, scrolling, and container requirement that
driver.js 1.12.1 did not meet is implemented as a direct change in `src/engine/`. This
milestone absorbs the seven former upstream tasks (U-01..U-07) and every PRD item the
layered design had dropped. Nothing waits for anyone.

Tasks: F-04 through F-14. They are independent of each other unless listed; all need
V-02 (engine seams) and V-03 (so the public API tests can cover them). Suggested order by
value: F-04, F-06, F-05, F-14, F-07, F-08, F-11, F-09, F-12, F-13, F-10.

Every task here changes files under `src/engine/`, updates `test/fixtures/fork-point.sha256`,
adds engine-level unit tests under `test/engine/` and specs under `e2e/engine/` (next to
the ported suites, same harnesses), adds the public-API surface in `compile.ts` if it is
not already compiled by V-01, and removes its "ignored until" note from `03-schemas.md`
§1.4. Line numbers are at the fork point.

---

## F-04 Clip the cut-out by the scroll containers that crop the target

**Goal.** When the highlighted element is partly scrolled out of an `overflow` ancestor,
cut out only the visible part instead of the element's full rectangle. Elements positioned
outside those containers (`position: fixed`) are revealed in full.

**PRD requirements covered.** H-5. (Was upstream task U-01.)

**Files in the fork.**
- `src/engine/types.ts` `Config.clipStageToScrollParents?: boolean` (default `true`;
  per step through `DriveStep` too).
- `src/engine/core/utils.ts`: extract `clipRectByScrollParents(element, rect): DOMRect`
  from the walk in `isClippedByScrollContainer` (109-142): intersect the rect with the
  padding-box of every ancestor whose computed `overflow-x`/`overflow-y` is not `visible`,
  stop at a `position: fixed` element or `document.body`; `isClippedByScrollContainer`
  reuses it.
- `src/engine/overlay/overlay.ts` `trackActiveElement` (44-61) and `transitionStage`
  (22-42): when the option is on, the "to" rect is the clipped rect. An empty intersection
  yields a zero-size stage (no hole), which the path code already draws.
- `src/engine/core/context.ts`: default.
- Public: `DimConfig.clipToScrollParents` (compiled by V-01).

**Public API.** `DimConfig.clipToScrollParents?: boolean` (default `true`).

**Tests.**
- Unit `test/engine/overlay-clip.test.ts` (jsdom, stubbed rects): a 200 px tall element
  whose scroller shows the top 80 px produces a stage of height 80; a fixed-position element
  inside a scroller is not clipped; option off keeps the old rect; an element fully scrolled
  out yields a zero-size hole.
- e2e `e2e/engine/overlay-clip.spec.ts` (3 browsers) + fixture content on `demo/e2e.html`:
  a list in a 200 px scroller with the third item half visible; the overlay path's hole
  height equals the visible part within 1 px; scroll the container by 50 px and the hole
  follows after `refresh()`.

**Acceptance criteria.** The V-07 overlay spec's "documented limitation" case asserts the
clipped behavior; `clipToScrollParents: false` restores the raw rect.

**Depends on.** V-03.

---

## F-05 Extra cut-outs anywhere, deduped

**Goal.** Allowed elements (`spotlight.extra`) are cut out of the overlay everywhere, not
only inside an open `<dialog>`, and nested extras produce one hole.

**PRD requirements covered.** H-3, H-4. (Was upstream task U-02.)

**Files in the fork.**
- `src/engine/overlay/overlay.ts` `allowedCutouts` (103-114): drop the
  `overlaySvg.closest("dialog")` guard; collect `[data-vt-extra]` rects from `document`
  (inside the overlay's layer when it is a dialog, else the whole document); dedupe with
  `dedupeRects(stage, rects)` (new in `overlay/stage.ts`): drop a rect fully inside the
  stage cut-out or inside another kept rect; clip each rect by its scroll parents when
  `clipStageToScrollParents` is on (F-04's helper). `generateExtraCutoutsPathString`
  (`stage.ts:74-108`) already builds the holes.
- `redrawOverlay` (134-141): redraw whenever allowed elements change, not only inside a
  dialog (`tour/allowed.ts:66` already passes `isOutsideDialogToo`).
- Public: `spotlight.extra` already compiles to `allowedElements` (V-01). The layer's
  `dedupeExtras` for state classes (V-07) reuses `dedupeRects`'s element-level rule.

**Public API.** None new; `spotlight.extra` now cuts out.

**Tests.**
- Unit `test/engine/allowed-cutout.test.ts`: two allowed elements → the path has three
  sub-paths after the viewport rect; an allowed element inside the active element adds no
  sub-path; an allowed element inside another allowed element adds no sub-path; one
  partly scrolled out of a scroller is clipped.
- e2e `e2e/engine/allowed-cutout.spec.ts`: the dimmed overlay is transparent over an
  allowed button outside any dialog (`elementFromPoint` at its center is the button; a
  screenshot pixel at its center is not darkened); `page.mouse.click` on it increments its
  counter.

**Acceptance criteria.** The ported `tests/tour/allowed-elements.test.ts` and
`e2e/engine/allowed-elements.spec.ts` stay green (behavior inside dialogs unchanged).

**Depends on.** F-04 (helper).

---

## F-06 Boundary, viewport padding, and `side: 'over'` for targets

**Goal.** Give the popover a boundary (the viewport intersected with the target's scroll
parents) and a padding, and let a step highlight an element while centering the popover.

**PRD requirements covered.** P-3, P-5 (padding part), A-3, P-7 for targets in scroll
containers (the popover stops covering the container's edges). (Was upstream task U-03.)

**Files in the fork.**
- `src/engine/types.ts`: `Config.popoverBoundary?: 'viewport' | 'scrollParents'` (default
  `'scrollParents'`), `DriveStep.popoverPadding?: number` (default `0`; `Config` too),
  `Popover.side` widens to `Side | 'auto' | 'over'` (`'auto'` is F-07).
- `src/engine/popover/position.ts` `repositionPopover` (55-174): replace the four
  `window.innerWidth/innerHeight` fit checks (65-75) and the clamps (115-117, `alignAlongEdge`
  32-53) with a `boundary` rect = viewport inset by `popoverPadding`, intersected with the
  padding-boxes of the anchor's scroll parents when `popoverBoundary === 'scrollParents'`
  (walk from `clipRectByScrollParents`, F-04; when the intersection is smaller than the
  popover on an axis, fall back to the viewport on that axis so the popover never becomes
  unreachable). `requiredSide === 'over'` already renders centered (119-123) against the
  viewport; keep that (P-8), but `tour/step.ts` `resolveStepPosition` (164-174) now sets
  `centered` from `side === 'over' || isDummyElement(element)` so a real element keeps its
  highlight while the popover centers.
- `src/engine/core/context.ts`: defaults.
- Public: `position.viewportPadding` → `popoverPadding`; absent `placement` with a target →
  `side: 'over'` (V-01 already compiles both).

**Public API.** `PositionOptions.viewportPadding`; `PlacementRef.side: 'over'`; A-3
behavior.

**Tests.**
- Unit `test/engine/boundary.test.ts`: with `popoverPadding: 20` a bottom-placed popover
  near the viewport bottom flips to top 20 px earlier than before; with `scrollParents` a
  target at the bottom of a 300 px scroller flips to top when the popover would cross the
  scroller's bottom edge; `side: 'over'` with an element centers the popover and keeps the
  element's `data-vt-target`; a scroller narrower than the popover falls back to the
  viewport on that axis.
- e2e `e2e/engine/popover-boundary.spec.ts` (3 browsers): three layouts (fixed header,
  nested scroller, long page); the popover rect stays inside the boundary within 1 px;
  A-3: a target with no placement is highlighted and the popover is centered with no arrow.

**Acceptance criteria.** The ported `popover-position.spec.ts` stays green with the
default boundary on a plain page (no scroll parents → viewport).

**Depends on.** F-04.

---

## F-07 Flip, alignment flip, shift switches, and `placement: 'auto'`

**Goal.** Make the fallback behavior configurable and add the best-fit side.

**PRD requirements covered.** P-1 (`auto`), P-4 (flip side or alignment, can be off),
P-5 (shift, can be off), P-10 (offset counted before flip and shift; already true,
`position.ts:61`).

**Files in the fork.**
- `src/engine/types.ts`: `Popover.flip?: boolean` (default `true`), `Popover.shift?:
  boolean` (default `true`), `Popover.side: 'auto'`.
- `src/engine/popover/position.ts`: (a) `side: 'auto'` → compute free space on all four
  sides against the boundary (F-06) and pick the largest; ties go bottom, top, right, left.
  (b) `flip: false` → use the requested side even when it does not fit (skip the fallback
  chain 129-157; `noneOptimal` centering 124-128 still applies only when `flip` is on).
  (c) Alignment flip: when `flip` is on and the aligned popover overflows the boundary
  along the edge, try the opposite alignment (`start` ↔ `end`) before shifting; `center`
  has no opposite. (d) `shift: false` → `alignAlongEdge` returns the raw start without the
  clamp (32-53), and the side clamps (`Math.min(leftValue, maxLeft)` etc.) are skipped.
- `src/engine/tour/step.ts` `resolveStepPosition`: pass `flip`, `shift`.
- `src/engine/core/context.ts`: defaults.

**Public API.** `PlacementRef = 'auto' | { side: ... | 'auto' }`, `PositionOptions.flip`,
`PositionOptions.shift`.

**Tests.**
- Unit `test/engine/placement.test.ts`: `auto` picks the side with the most room in four
  stubbed layouts; `flip: false` keeps `bottom` when the popover would overflow (the wrapper's
  `top` goes past the viewport); alignment flip turns `start` into `end` when the start
  alignment overflows and the end fits; `shift: false` lets `style.left` go negative.
- e2e `e2e/engine/placement.spec.ts` (3 browsers): a target in the top-right corner with
  `auto` gets the popover on the left or bottom (whichever has more room, asserted from
  the rects); `flip: false` + `shift: false` on an edge target overflows visibly (rect
  partly outside the viewport); the arrow still points at the target in every case.

**Acceptance criteria.** Defaults reproduce upstream behavior exactly (ported
`popover-position.spec.ts` and `tests/popover/popover.test.ts` green).

**Depends on.** F-06.

---

## F-08 Cross-axis offset, RTL mirroring, arrow off and minimum inset

**Goal.** A second offset along the edge, mirrored in right-to-left layouts; `start`/`end`
and the side fallback mirrored in RTL; the arrow can be turned off and its corner inset set.

**PRD requirements covered.** P-2 (cross-axis, RTL), P-9, NF-tests (RTL suite). (Was
upstream task U-04 plus the dropped P-2/P-9 items.)

**Files in the fork.**
- `src/engine/core/env.ts` (new in F-14; create here if F-08 lands first): `isRtl(el)` =
  `getComputedStyle(el).direction === 'rtl'`.
- `src/engine/types.ts`: `DriveStep.popoverCrossOffset?: number` (default `0`),
  `Popover.arrow?: boolean` (default `true`), `Popover.arrowMinInset?: number` (default
  `15`).
- `src/engine/popover/position.ts`: compute `rtl = isRtl(anchor)` once in
  `repositionPopover`; in `alignAlongEdge` (32-53) swap `start`/`end` for the horizontal
  axis when `rtl`; add `crossOffset` (sign flipped in RTL for the horizontal axis) to the
  along-edge position before shifting; in the fallback chain (129-157) check
  `isRightOptimal` before `isLeftOptimal` when `rtl`; `ARROW_CORNER_INSET` (178) becomes a
  parameter `minInset` of `calculateArrowTarget` and `calculateArrowOffset` (180-223);
  `renderPopoverArrow` adds `vt-no-arrow` to the wrapper and `vt-popover-arrow-none` to the
  arrow when `arrow === false`, and the fit math uses `offset` without the arrow's size in
  that case.
- Wrapper class `vt-popover-rtl` so CSS can mirror the close button; `base.css`:
  `.vt-popover-rtl .vt-popover-close-btn { right: auto; left: 0 }`.
- `src/engine/tour/step.ts` `resolveStepPosition`: pass `crossOffset`, `arrow`, `minInset`.
- Key handling is **not** touched: ArrowRight stays forward in RTL (owner decision).

**Public API.** `PositionOptions.offset: { main, cross }`, `PositionOptions.arrow: boolean |
{ minInset }`.

**Tests.**
- Unit `test/engine/rtl.test.ts` (jsdom with `direction: rtl` on `<html>`): `align: 'start'`
  on `side: 'top'` places the popover's right edge at the element's right edge; the arrow
  offset mirrors; `cross: 20` moves the popover 20 px toward inline-end (left in RTL);
  side fallback prefers right in RTL.
- Unit `test/engine/arrow.test.ts`: `minInset: 30` keeps the arrow at least 30 px from the
  corner; `arrow: false` hides it and the popover sits `offset` px from the target (no
  arrow allowance).
- e2e `e2e/engine/rtl.spec.ts` with a `dir="rtl"` fixture page (`demo/e2e-rtl.html`):
  start/end mirror within 1 px; the close button sits at the top-left; `cross` offsets are
  mirrored; keys: ArrowRight still goes forward.
- e2e `e2e/engine/arrow.spec.ts`: `vt-no-arrow` hides the arrow (`getBoundingClientRect`
  width 0); `minInset` respected on `start` and `end` alignments.

**Acceptance criteria.** LTR behavior unchanged (ported specs green); every RTL assertion
has an LTR twin that passes with the mirrored expectation.

**Depends on.** F-07.

---

## F-09 Follow nested scroll containers; scroll-lock option

**Goal.** Reposition the popover and the cut-out when an ancestor scroll container
scrolls, not only when the window scrolls; make the scroll lock the engine puts on the
target's parent optional and off by default.

**PRD requirements covered.** P-7 (scroll containers), H-1 steady state in scrollers.
(Was upstream task U-05.)

**Files in the fork.**
- `src/engine/interaction/events.ts:141`: `window.addEventListener("scroll", onWindowScroll,
  true)` (capture) so element scroll events reach the listener; same for the remove call
  (159). `requireRefresh` already coalesces to one rAF.
- `src/engine/types.ts` `Config.lockScrollParent?: boolean` (default `false`);
  `src/engine/tour/highlight.ts:276-278` adds `data-vt-lock-scroll` only when the option is
  on. `engine.css` keys the `overflow: hidden !important` rule (`driver.css:59-61`) on that
  attribute.
- `src/engine/core/context.ts`: default.
- Public: `DimConfig.lockScrollParent` (compiled by V-01).

**Public API.** `DimConfig.lockScrollParent?: boolean` (default `false`).

**Tests.**
- Unit `test/engine/scroll-capture.test.ts`: dispatching `scroll` on a nested `div`
  triggers one `refresh` (spy on the rAF callback running `refreshActiveHighlight`); with
  `lockScrollParent: true` the parent gets `data-vt-lock-scroll`; default does not.
- e2e `e2e/engine/scroll.spec.ts` (extend the ported spec): `mouse.wheel` over the target's
  scroller moves the target and the popover's offset from the target stays within 1 px over
  five positions; the cut-out follows; with `lockScrollParent: true` the scroller does not
  move.

**Acceptance criteria.** Documented in `docs/guide/overlay.md` (V-14): under `dim: true`,
wheel scrolling over a nested scroller that is not the target still scrolls the document,
because everything outside the target is non-interactive (`engine.css` pointer-events rule);
under `dim: false` nested scrollers scroll normally and the popover follows.

**Depends on.** V-03.

---

## F-10 Position strategy: `absolute`

**Goal.** Offer `absolute` positioning for pages where `fixed` misbehaves (an ancestor with
`transform`, `filter`, or `contain: paint` makes `fixed` relative to that ancestor; `zoom`
on the body) and for mount containers that scroll.

**PRD requirements covered.** P-6, P-8 (centered steps stay `fixed`).

**Files in the fork.**
- `src/engine/types.ts` `Popover.strategy?: 'fixed' | 'absolute'` (default `'fixed'`;
  see `12-risks-open-questions.md` question #1 on the default).
- `src/engine/popover/position.ts`: when `strategy === 'absolute'` and the step is not
  centered, add `window.scrollX`/`scrollY` (or the mount container's scroll offsets when
  `mountIn` is a scrolling element, F-13) to the computed `left`/`top`, and use `top/left`
  only (never `bottom/right`, since those are viewport-relative in the `fixed` math at
  126-157); set `data-vt-strategy="absolute"` on the wrapper. `base.css`:
  `.vt-popover[data-vt-strategy="absolute"] { position: absolute }`.
- `src/engine/overlay/overlay.ts` `createOverlaySvg` (155-169): the overlay stays `fixed`
  (it covers the viewport); the cut-out math is viewport-relative already.
- `src/engine/tour/step.ts` `resolveStepPosition`: pass `strategy`; `centered` steps force
  `fixed` (P-8).

**Public API.** `PositionOptions.strategy`.

**Tests.**
- Unit `test/engine/strategy.test.ts`: with `window.scrollY = 300` stubbed, `absolute`
  writes `top` 300 px larger than `fixed` does for the same target; centered steps ignore
  the strategy; `bottom`/`right` are never written in absolute mode.
- e2e `e2e/engine/strategy.spec.ts` (3 browsers): a page whose `#app` has
  `transform: translateZ(0)`: with `fixed` the popover is offset from the target (the known
  containing-block effect, asserted so the test documents why the option exists); with
  `absolute` the popover sits next to the target within 1 px; after `window.scrollBy(0,
  200)` it still does (reposition on scroll).

**Acceptance criteria.** Default behavior unchanged (ported specs green).

**Depends on.** F-06, F-13 (mount container scroll offsets; if F-13 is later, land the
window-only part and finish in F-13).

---

## F-11 Reveal: off, native scroll options, and the custom handler ordering

**Goal.** Let a step turn the scroll-into-view off or pass native `ScrollIntoViewOptions`,
and make the engine skip its own scroll when the public layer's `revealWith` ran.

**PRD requirements covered.** SC-1, SC-2 (ordering).

**Files in the fork.**
- `src/engine/types.ts` `DriveStep.scrollIntoView?: false | ScrollIntoViewOptions`
  (`Config` too; default: the engine's existing rule).
- `src/engine/core/utils.ts` `bringInView` (73-85): takes `false | ScrollIntoViewOptions |
  undefined`; `false` returns at once; an options object is passed to `scrollIntoView` as
  is (the "already in view" early return stays); `undefined` keeps the current behavior
  (`inline: center`, `block: center` or `start` for tall elements, `behavior` from
  `smoothScroll`).
- `src/engine/tour/highlight.ts:218` and `popover/popover.ts:307`: pass the step's
  option (the popover's own `bringInView` of the wrapper uses `false` when the step says
  `false`).
- Public: `reveal` compiles per `03-schemas.md` §1.4; `revealWith` sets `scrollIntoView:
  false`.

**Public API.** `StepConfig.reveal: boolean | 'smooth' | ScrollIntoViewOptions`.

**Tests.**
- Unit `test/engine/scroll-into-view.test.ts`: `false` never calls `scrollIntoView` (spy);
  `{ block: 'start', behavior: 'smooth' }` is passed through; default calls with the
  upstream arguments.
- e2e `e2e/engine/reveal.spec.ts` (3 browsers): a target 1 600 px down: default scrolls it
  into view; `reveal: false` leaves `scrollY` at 0 and the popover is positioned against
  the off-screen rect (documented); `reveal: { block: 'start' }` puts the target at the top
  of the viewport within 2 px; `revealWith` is awaited and the engine does not scroll again
  (spy on `scrollIntoView` counts one call from the handler).

**Acceptance criteria.** Ported `scroll.spec.ts` green.

**Depends on.** V-04.

---

## F-12 Per-corner cut-out radius

**Goal.** `radius` accepts one number or four corner values.

**PRD requirements covered.** H-2.

**Files in the fork.**
- `src/engine/types.ts`: `stageRadius?: number | { topLeft; topRight; bottomRight;
  bottomLeft }` on `Config` and `DriveStep`.
- `src/engine/overlay/stage.ts` `stageCutout` (38-50) and `generateStageSvgPathString`
  (52-66): four radii, each limited to half the width/height; the path uses one arc per
  corner with its own radius. `generateExtraCutoutsPathString` (94-105) uses the matching
  corner radius for its corner patches.
- Public: `DimConfig.radius`, `SpotlightOptions.radius` (compiled by V-01).

**Public API.** `CornerRadius`.

**Tests.**
- Unit `test/engine/stage-radius.test.ts`: a number produces the upstream path string
  unchanged (snapshot from the ported suite); `{ topLeft: 0, topRight: 10, bottomRight: 10,
  bottomLeft: 0 }` produces a path with two `a0,0` arcs and two `a10,10` arcs in corner
  order; radii are clamped per corner.
- e2e `e2e/engine/stage-radius.spec.ts` (chromium): screenshot pixel checks at the four
  corners of the cut-out (sharp vs rounded).

**Acceptance criteria.** Ported `highlight.test.ts` snapshot unchanged for the number form.

**Depends on.** V-03.

---

## F-13 Mount containers for the popover and the overlay

**Goal.** Let the integrator choose where the popover and the overlay are inserted.

**PRD requirements covered.** T-6.

**Files in the fork.**
- `src/engine/types.ts` `Config.mountIn?: Element | (() => Element)`,
  `Config.dimMountIn?: Element | (() => Element)`.
- `src/engine/core/utils.ts` `layerFor` (150-180) gains a `kind: 'popover' | 'overlay'`
  parameter: when the matching option is set, resolve it and return that element instead
  of `document.body`; the open-`<dialog>` rule still wins when the target is inside an open
  dialog (otherwise the popover would render under the dialog's top layer), and the docs
  say to pass the dialog itself as `mountIn` to override. `moveToLayerOf` and `placeInLayer`
  unchanged.
- `src/engine/overlay/overlay.ts` `mountOverlay` (74-90) uses `layerFor(element,
  'overlay')`; the SVG keeps `position: fixed` so a non-body container must not create a
  containing block (documented; `strategy: 'absolute'` is the pairing for scrolling
  containers, F-10).
- Shadow roots and iframes: not supported in v1 (owner decision 2026-11-12). `layerFor`
  throws `Error('mountIn must be an element in the document')` when the resolved
  element's `ownerDocument !== document` or when it is inside a shadow root
  (`getRootNode() !== document`).
- Public: `TourConfig.mountIn` / `dimMountIn` (compiled by V-01; JSON carries selectors,
  V-11).

**Public API.** `TourConfig.mountIn`, `TourConfig.dimMountIn`.

**Tests.**
- Unit `test/engine/mount-in.test.ts`: the popover is a child of `mountIn`; the overlay is
  a child of `dimMountIn`; a function form is called at mount time; a shadow-root host
  throws; a target inside an open `<dialog>` still mounts in the dialog's layer.
- e2e `e2e/engine/mount-in.spec.ts` (3 browsers): `mountIn: '#app'` (resolved by the demo
  page) places the popover inside `#app` and it is still positioned next to the target
  within 1 px; with `#app { transform: translateZ(0) }` and `strategy: 'absolute'` it stays
  attached after scrolling; the overlay inside `#dim` still blocks clicks outside the
  cut-out.

**Acceptance criteria.** Defaults unchanged (ported `dialog.spec.ts` green).

**Depends on.** V-03.

---

## F-14 Reduced motion in the engine

**Goal.** The engine itself honors `prefers-reduced-motion`: no JavaScript tween for the
cut-out, no CSS fade, no nudge shake (the flash stays).

**PRD requirements covered.** X-5, H-6. (Was upstream task U-07.)

**Files in the fork.**
- `src/engine/core/env.ts` (new): `prefersReducedMotion()` =
  `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false`; `isBrowser()`;
  `isRtl()` moves here from `utils.ts` if F-08 landed first.
- `src/engine/tour/highlight.ts:130,185`: `isAnimatedTour = ctx.getConfig("animate") &&
  !prefersReducedMotion()`, evaluated per `transferHighlight` call so a mid-tour OS change
  takes effect; line 185 uses the same value so no tween runs and the popover renders at
  once.
- `src/engine/driver.ts:387`: `init()` picks `<ns>-simple` over `<ns>-fade` under reduced
  motion; `engine.css` additionally wraps the fade keyframes (`driver.css:51-57`) in
  `@media (prefers-reduced-motion: no-preference)`. Both, so the class keeps the state
  consistent and the media query protects integrators who add the class themselves.
- Public: nothing to compile; `TourConfig.animate` still exists for turning motion off
  without the OS preference.

**Public API.** None new.

**Tests.**
- Unit `test/engine/reduced-motion.test.ts`: with `matchMedia` stubbed to match,
  `__activeStagePosition` equals the target rect on the first frame after `moveNext()`;
  `<body>` has `<ns>-simple`; the OS change mid-tour (stub flips) takes effect on the next
  step.
- e2e `e2e/engine/animation.spec.ts` (extend the ported spec): `page.emulateMedia({
  reducedMotion: 'reduce' })` → the overlay path `d` equals the final path immediately after
  the Next click; `document.getAnimations()` is empty.

**Acceptance criteria.** With motion on, the ported `animation.spec.ts` is unchanged.

**Depends on.** V-03.
