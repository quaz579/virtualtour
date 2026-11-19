# 07. Milestone 3: presentation

Outcome: `dim` and `spotlight` are mapped and proven in real browsers, the stylesheets and
theme exist with dark mode, and dialog mode passes an automated WCAG 2.2 AA audit. Avatar
mode is audited again in A-08 once it exists.

Tasks: V-07, V-08, V-09. V-07 and V-08 are independent; V-09 needs both. V-07 needs the
M2 overlay tasks it asserts (F-04, F-05, F-14); V-08 needs V-05.

---

## V-07 Spotlight mapping, state classes, click blocking

**Goal.** Map `dim` and `spotlight` to the engine's overlay, add VirtualTour's state classes
on the target and extras, dedupe nested extras for state classes, and support
`clickOutside`. The reduced-motion and clipping behavior is engine code now (F-14, F-04);
this task proves it through the public API.

**PRD requirements covered.** T-5, H-1, H-2, H-3, H-4, H-5 (public proof), H-6 (public
proof), H-7, H-8, X-5 (overlay part, public proof), A-2/A-3 interplay with `dim`.

**Files in the fork.** `src/spotlight/options.ts` (`dedupeExtras(elements)`,
`applyStateClasses`, `removeStateClasses`, class guard), `src/tour.ts` (overlay click hook,
state classes in `onHighlightStarted`/`onDeselected`), `src/compile.ts` (`dim` → overlay
options), `test/spotlight/options.test.ts`, `e2e/overlay.spec.ts`,
`demo/fixtures/overlay.html` (targets with click counters, extras, nested extras, a
half-visible list item in a scroller, a page button outside the tour).

**Public API added.** `TourConfig.dim` (`true | DimConfig`), `DimConfig` fields,
`StepConfig.spotlight` fields `padding`, `radius`, `extra`, `class`, `targetInteractive`.

Rules:
- `dim: true` → engine overlay with `overlayColor`, `overlayOpacity`, `stagePadding`,
  `stageRadius`, `duration`, `lockScrollParent`, `clipStageToScrollParents` from
  `DimConfig`; `dim: false` → `overlay: false` (V-02): no SVG, no `data-vt-dim`, page stays
  interactive, target still marked and the popover still positioned.
- `clickOutside`: `'none'` → the overlay click hook does nothing; `'exit'` →
  `tour.exit()` (prompt applies); `'forward'` → `tour.forward()`.
- `spotlight.extra`: resolved with `querySelectorAll` at show time; `dedupeExtras` drops
  elements contained in the target or in another extra (H-4) for the state classes; the
  full list goes to `allowedElements` (the engine dedupes the cut-outs itself, F-05).
- State classes: `<ns>-spotlit` + `spotlight.class` on target and extras in
  `onHighlightStarted`; extras are re-resolved and the classes follow a re-bound target on
  `onReposition`; a class the element already had is left alone on removal. Released in
  `onDeselected` unless the next step uses the same element (no flicker; the navigator
  resolved the next target before `moveTo`), and on `hideCurrent` and at run end. A
  selector that does not parse skips the extras and still marks the target. A MutationObserver
  re-adds `<ns>-spotlit` if the app's framework rewrites `className` (same reason the
  engine guards its own markers, `tour/highlight.ts:227-240`).
- `targetInteractive: false` → `disableActiveInteraction: true`; `'hover-only'` →
  `"clicks"`; with `dim: false` the block still applies (`data-vt-blocked` rule in
  `engine.css`).

**Tests/proof required.**
- Unit (jsdom, real engine): compiled overlay options for `dim:true`, a full `DimConfig`,
  and `dim:false`; per-step `spotlight.padding` reaches the step's `stagePadding`;
  `dedupeExtras` cases (inside target, inside another extra, equal elements); classes
  added/removed; shared element between consecutive steps has zero class mutation records
  on the shared element; class guard re-adds; `clickOutside` variants.
- e2e `overlay.spec.ts` (3 browsers): (a) a click inside the cut-out reaches the target
  (counter increments); (b) a click in the dimmed area does not reach the page element and
  does not close the tour with `clickOutside:'none'`, closes it with `'exit'`; (c) the
  overlay path fill opacity equals `dim.opacity`; (d) `targetInteractive:false` blocks the
  click (counter unchanged) and `elementFromPoint` at the target center is not the target;
  (e) two extras are clickable while dimmed and the overlay is transparent over them
  (F-05); (f) nested extras produce one hole (count the sub-paths in the overlay `d`);
  (g) with `page.emulateMedia({ reducedMotion: 'reduce' })` the overlay path `d` equals the
  end path right after `forward()` resolves and `<body>` has `vt-simple`, not `vt-fade`;
  (h) `dim:false` leaves a page button outside the tour clickable and no overlay exists;
  (i) the half-visible list item's cut-out equals the visible part (F-04) and extends past
  the scroller edge with `clipToScrollParents: false`; (j) per-corner radius renders
  (visual check at two corners); (k) screenshot attached.

**Acceptance criteria.** `elementFromPoint` at the target center returns the target or a
descendant when interactive, and at a dimmed point returns the overlay path; no tween under
reduced motion in all three engines.

**Depends on.** V-04, F-04, F-05, F-12, F-14.

---

## V-08 Stylesheets: `base.css`, theme, dark mode, missing-stylesheet warning

**Goal.** Finish `base.css` (the engine's functional rules plus the popover visuals
inherited from driver.js's `popover.css`, with VirtualTour's class names and the layer
parts), a variable-driven `theme.css` with dark mode and entrance animation, the class
contract, and the dev warning when the stylesheet is missing.

**PRD requirements covered.** ST-1, ST-2, ST-3, ST-4, D-3, X-2 (focus ring styling),
X-5 (entrance respects reduced motion), X-6 (default colors meet contrast).

**Files in the fork.** `src/styles/base.css`, `src/styles/theme.css`,
`src/engine/styles/engine.css` (only if a functional rule is missing), `src/tour.ts`
(warn once at `start()` in dev builds), `packages/core/STYLES.md`, `test/styles.test.ts`,
`e2e/theme.spec.ts`, `demo/fixtures/theme.html`.

**Public API added.** The class contract and CSS variables below.

Class contract (ST-4), all stable public API:

| Part | Fixed class (not namespaced) | Namespaced class / attribute (`<ns>` = `namespace`, default `vt`) | Mechanism attribute (fixed) |
|---|---|---|---|
| Popover root | `vt-popover` (+ `vt-popover-side-*`, `vt-popover-align-*`, `vt-popover-rtl`, `vt-no-arrow`, `vt-waiting`, `vt-popover-nudge`, `vt-popover-has-instruction`, `vt-popover-instruction-done`), `vt-dialog` or `vt-speaker` | `data-<ns>-step="<id>"`, `data-<ns>-side` | `data-vt-strategy` |
| Title / close / description | `vt-popover-title`, `vt-popover-close-btn`, `vt-popover-description` | | |
| Body (Element) | `vt-body` | | |
| Footer | `vt-popover-footer`, `vt-popover-progress-text`, `vt-popover-navigation-btns`, `vt-popover-prev-btn`, `vt-popover-next-btn`, `vt-popover-footer-btn`, `vt-popover-done-btn`, `vt-popover-btn-disabled` | | |
| Custom buttons | `vt-footer`, `vt-button`, `vt-button--secondary` | | |
| Instruction / feedback | `vt-popover-instruction`, `vt-popover-instruction-text`, `vt-popover-instruction-indicator`, `vt-popover-feedback` | | |
| Arrow | `vt-popover-arrow`, `vt-popover-arrow-side-*`, `vt-popover-arrow-none`, `vt-bubble-tail` (avatar) | | |
| Overlay | | `<ns>-overlay` | `data-vt-overlay` |
| Target | | `<ns>-target`, `<ns>-target-blocked`, `<ns>-target-raised`, `<ns>-spotlit`, `spotlight.class` | `data-vt-target`, `data-vt-blocked`, `data-vt-raised` |
| Extras | | `<ns>-extra`, `<ns>-spotlit` | `data-vt-extra` |
| Target parent | | `<ns>-target-parent` | `data-vt-target-parent`, `data-vt-lock-scroll` |
| Body while running | | `<ns>-active`, `<ns>-fade` / `<ns>-simple`, `<ns>-no-scroll` | `data-vt-active`, `data-vt-dim` |
| Dialog layer | `vt-layer` | | `data-vt-layer` |
| Live region | `vt-live-region` | | |
| Avatar | `vt-speaker`, `vt-bubble`, `vt-avatar-slot`, `vt-avatar`, `data-vt-dock` | | |

`base.css` content: `@import "../engine/styles/engine.css";` then the popover visuals
(the former `popover.css:1-197` with renamed classes: layer rules, `.vt-popover` box, title,
close button, description, footer, buttons, arrow sides), `.vt-popover-rtl` close-button
mirror (F-08), `[data-vt-strategy="absolute"]` (F-10), `.vt-no-arrow .vt-popover-arrow {
display: none }`, `.vt-footer` (flex, gap, margin-top), `.vt-button` (matches
`vt-popover-footer-btn` metrics), `.vt-button--secondary` (transparent background),
`.vt-body` (margin-top 5px), marker `.vt-popover { --vt-base: 1 }`. About 4 KB raw.

`theme.css` (ST-3): variables `--vt-accent`, `--vt-bg`, `--vt-fg`, `--vt-muted`,
`--vt-radius`, `--vt-space`, `--vt-shadow`, `--vt-font`, `--vt-enter-duration`,
`--vt-progress-index`, `--vt-progress-total`; applied to `.vt-popover` (overriding the
hard-coded colors inherited from `popover.css:28-131`), `.vt-button`, `.vt-popover-footer-btn`;
dark mode via `@media (prefers-color-scheme: dark)` and `[data-vt-theme="dark"]`; light
forced via `[data-vt-theme="light"]`; focus ring `.vt-popover:focus-visible,
.vt-button:focus-visible, .vt-popover-footer-btn:focus-visible { outline: 2px solid
var(--vt-accent); outline-offset: 2px }`; `vt-enter` keyframes on `.vt-fade .vt-popover`
guarded by `@media (prefers-reduced-motion: no-preference)`; an optional progress bar
`.vt-popover[data-vt-progress-bar]::after` using the progress variables (filled by V-12).
Under 4 KB raw.

ST-2 warning: at `start()` in dev builds, after the first popover renders, read
`getComputedStyle(wrapper).getPropertyValue('--vt-base')`; warn once if empty
("VirtualTour: base.css is not loaded").

**Tests/proof required.**
- Unit: both stylesheets parse (a CSS parser dev dependency); every variable in
  `STYLES.md` appears in `theme.css`; every class in the table above appears in
  `src/engine/core/namespace.ts` or `src/render/**` (so the table is complete);
  `start()` without the stylesheet warns once in a dev build, never in the prod build; with
  the marker injected no warning.
- e2e `theme.spec.ts` (3 browsers): base: the popover is visually boxed and text/background
  pass 4.5:1 (computed in the test); theme light and dark pass 4.5:1 text and 3:1 focus
  ring; `prefers-color-scheme: dark` emulation switches colors; `:focus-visible` shows an
  outline on a keyboard-focused `.vt-button`; reduced motion → `document.getAnimations()`
  is empty right after `start()`; `vt-no-arrow` hides the arrow; screenshots light and
  dark attached.

**Acceptance criteria.** `STYLES.md` lists every class and variable in the table; removing
`theme.css` leaves a usable plain popover; `base.css` under 5 KB raw.

**Depends on.** V-05, F-08, F-10.

---

## V-09 Accessibility: WCAG 2.2 AA audit (dialog mode)

**Goal.** Verify everything the engine does for accessibility (now including the native
accessible name and reduced motion), and lock it with an automated audit. Avatar mode is
added to the same audit in A-08.

**PRD requirements covered.** X-1, X-2, X-3, X-4, X-5, X-6.

**Files in the fork.** `test/a11y.test.ts`, `e2e/a11y.spec.ts` (an accessibility engine as
a dev dependency in the test runner only), `docs/guide/accessibility.md` (stub with the
manual screen-reader script).

**Public API added.** None.

Checks:
- Dialog name: title → `aria-labelledby`; label → `aria-label`; neither → unnamed and dev
  warning (documented).
- `aria-describedby` points at the description (string body) or `.vt-body` (Element body),
  plus the instruction text when an action step shows one (`popover.ts:111-118,153`).
- Close and buttons have accessible names (the engine sets `aria-label` on close,
  `popover.ts:189`).
- Focus: enters the popover on show, Tab trap covers close → engine buttons → custom
  buttons → target → extras, returns to the trigger on end.
- Keyboard: Escape exits; arrows navigate; arrows and Escape inside an input or ARIA widget
  within the target go to the app (`interaction/keys.ts`); `keys.escape:false` and
  `keys.arrows:false` honored.
- Reduced motion: no tween (`vt-simple`), no fade, no theme entrance, no glide (V-12), no
  avatar motion (A-06); nudge flashes instead of shaking.
- Contrast: base and theme colors 4.5:1 text, 3:1 focus ring.
- Zoom 200%: the popover stays within the boundary (`max-width` + engine shift) and
  remains operable.
- Live region: the engine announces popover text changes (`popover/live-region.ts`); the
  layer's `configure()` goes through `updatePopover` so changes are announced (asserted by
  reading the live region's text).
- Screen reader smoke: manual (VoiceOver, NVDA); script in the docs stub; one run recorded
  in the PR.

**Tests/proof required.**
- Unit: attribute matrix for name/description across title/label/none and string/Element
  bodies and with/without an instruction.
- e2e (3 browsers): the accessibility engine reports zero violations on a titled step, an
  untitled labeled step, a centered step, a spotlit step, an action step, and a step with
  custom buttons; keyboard-only completion of a 4-step tour; 200% zoom keeps the popover in
  the viewport; reduced motion → `document.getAnimations().length === 0` after `start()`
  and after `forward()`; the live region text equals the new title after `configure()`.

**Acceptance criteria.** Zero violations in all engines; manual screen-reader run recorded
in the PR description.

**Depends on.** V-07, V-08, V-06.
