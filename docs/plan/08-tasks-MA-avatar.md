# 08. Milestone A: avatar

Outcome: the `./avatar` entry renders an animated character beside a speech bubble that the
engine's popover renderer builds natively, with per-step animations, an idle loop,
reduced-motion support, pack loading (project format and the two classic formats), and the
shipped original character Thumbtack. The core entry's size is unchanged except for the
speaker layout branch in the engine (a few hundred bytes).

Placement: after M3 (the speaker needs the presenter parts from V-05 and the overlay
mapping from V-07) and before M5 (so docs and the final audit cover it).

Tasks: A-01 through A-08. A-01, A-02, A-03 are independent of each other and of M1-M3 and
can start right after F-03. A-04 needs V-05, V-07, and F-08.

Requirement IDs `AV-*` are defined in `02-avatar.md` §1.

---

## A-01 Avatar pack types, validation, normalization, preload

**Goal.** Define the v1 pack format in code, validate it, normalize frames to pixel
offsets, resolve roles, and preload the sheet image.

**PRD requirements covered.** AV-1, AV-3, AV-9 (validation and preload parts), AV-7.

**Files in the fork.** `src/avatar/pack.ts`, `src/avatar/index.ts` (types only for
now), `schemas/avatar-pack.v1.schema.json`, `test/avatar/pack.test.ts`.

**Public API added.**
```ts
interface AvatarPack { format: 'virtualtour-avatar/1'; name: string; version?: string; sheet: SheetInfo; animations: Record<string, AnimationDef>; roles: RoleMap; bubble?: BubbleHints; license?: LicenseInfo }
interface NormalizedPack extends AvatarPack { frames: Record<string, { x: number; y: number; ms: number }[]>; sheetUrl: string; stillOf(name: string): number }
class AvatarPackError extends Error { path: string }
function validatePack(json: unknown): AvatarPack;       // throws AvatarPackError
function normalizePack(pack: AvatarPack, baseUrl: string): NormalizedPack;
function preloadSheet(url: string): Promise<void>;     // Image + decode(), rejects on error
type AvatarRole = 'rest' | 'idle' | 'greet' | 'point' | 'think' | 'celebrate' | 'exit' | 'alert';
function resolveRole(pack: NormalizedPack, role: AvatarRole, dir?: 'left'|'right'|'up'|'down', avoid?: string): string;
```

Rules: `03-schemas.md` §2.2. `resolveRole('point', dir)` falls back `point.<dir>` →
`point.any` → `greet` → `rest`; `resolveRole('idle', _, avoid)` picks a random idle not
equal to `avoid` (deterministic under an injected RNG for tests). `col/row` → `x = col *
frameWidth`, `y = row * frameHeight` in CSS px; `scale` divides pixel positions given in
device px.

**Tests/proof required.** Unit: valid pack passes; each validation rule throws with the
expected path; `col/row` and `x/y` both normalize; `still` default rules (last frame for
non-loop, 0 for loop); role fallbacks; `preloadSheet` rejects on a 404 (jsdom `Image`
stub) and resolves on load; the JSON Schema file validates the Thumbtack `pack.json` and
rejects five malformed fixtures (dev-only validator).

**Acceptance criteria.** No DOM access at import; `preloadSheet` is the only DOM user.

**Depends on.** F-03.

---

## A-02 Sprite player and the frame scheduler

**Goal.** Play named animations from a sprite sheet on a `<div>` background, driven by one
`requestAnimationFrame` loop, with loop, stop, still, and reduced motion.

**PRD requirements covered.** AV-2, AV-6 (player part), X-5.

**Files in the fork.** `src/dom/frame.ts` (`subscribe(fn): () => void`; one rAF loop
while subscribers exist; passes `performance.now()`), `src/avatar/player.ts`,
`src/avatar/index.ts` (export `SpritePlayer`), `test/dom/frame.test.ts`,
`test/avatar/player.test.ts`, `e2e/avatar-player.spec.ts`, `demo/fixtures/avatar-player.html`
(uses the synthetic test pack from A-03).

**Public API added.** `SpritePlayer` as in `02-avatar.md` §3.2.

Rules: `02-avatar.md` §3.1 and §3.3. The player subscribes to `dom/frame.ts` only while an
animation runs. `play` resolves `void` when done or when interrupted by another `play` or
`stop`. `dispose` stops and clears inline styles. The element is created once and owned by
the player; moving it between parents (A-04) does not reset state. Reduced motion is read
through `engine/core/env.ts` `prefersReducedMotion()` (F-14) so the whole library reads one
source.

**Tests/proof required.**
- Unit (stubbed rAF with a controllable clock): frame index at given elapsed times matches
  the cumulative table; loop wraps; non-loop ends on `still`; interruption resolves the first
  promise; reduced motion shows the still and resolves immediately; hidden-tab shift keeps
  the elapsed time; `dispose` unsubscribes; `frame.ts` coalesces 100 subscribers into one
  rAF per frame and stops the loop when the last unsubscribes.
- e2e (3 browsers): on the fixture page, play a 4-frame synthetic animation and sample
  `background-position` at 4 points in time; each sample is a valid frame offset and the final
  one is the still frame; with `reducedMotion: 'reduce'` the position never changes.

**Acceptance criteria.** The player never uses `setTimeout`/`setInterval` for frame timing.

**Depends on.** A-01, F-14.

---

## A-03 Thumbtack character, pack build tooling, synthetic test pack

**Goal.** Create the original Thumbtack character as code-generated SVG frames (the final
art approach, decided 2026-11-12: no illustrator pass follows), the build script that
rasterizes them into `sheet.png` + `pack.json`, and the synthetic test pack generator used
by e2e for the classic formats.

**PRD requirements covered.** AV-12, `02-avatar.md` §9.

**Files in the fork.** `src/avatar/thumbtack/svg/**`, `src/avatar/thumbtack/pack.json`,
`src/avatar/thumbtack/sheet.png`, `src/avatar/thumbtack/frames.mjs` (parametric
description), `tools/build-thumbtack-pack.mjs`, `tools/make-test-pack.mjs`,
`src/avatar/thumbtack/LICENSE-ART.md` (CC0 1.0 text with the one-line header from
`13-licensing.md` §7; the build copies it into `dist/thumbtack/`),
`test/avatar/thumbtack.test.ts`, `packages/core/ART.md` (two paragraphs: Thumbtack is
original, generated by code, released under CC0 1.0 with a link to `LICENSE-ART.md`, and
the rule that no third-party character art enters the repository).

**Public API added.** None yet (`thumbtackPack()` arrives in A-07). The exported assets
`./thumbtack/pack.json` and `./thumbtack/sheet.png` exist in `dist/`.

Rules:
- `build-thumbtack-pack.mjs`: reads `frames.mjs` (per animation, per frame: tilt angle, eye
  direction, eyebrow raise, blink, squash), writes one SVG per frame into
  `svg/<animation>/<nn>.svg` (committed), launches Playwright's Chromium, renders each SVG
  at 2x into a canvas grid, writes `sheet.png` (`frameWidth: 96, frameHeight: 96, scale: 2,
  columns: 10`), and writes `pack.json` with frames, durations (default 80 ms, per-animation
  overrides), `loop`, `still`, roles from `02-avatar.md` §9.1, and `license`.
- The character description must follow `13-licensing.md` §4 (not a paperclip;
  independently drawn; no traced or imported art).
- `make-test-pack.mjs`: generates `e2e/fixtures/test-pack/` with a 4x4 grid of colored
  squares with frame numbers drawn on them, plus three maps: `pack.json` (v1 format),
  `classic-a.json` (column/row list), `classic-b.json` (position map). Used only by tests.

**Tests/proof required.**
- `node tools/build-thumbtack-pack.mjs` runs from a clean checkout and produces a sheet whose
  dimensions equal `columns * frameWidth * scale` by `ceil(frames / columns) * frameHeight * scale`
  (unit test reads the PNG header).
- `pack.json` validates with `validatePack` and every role resolves.
- `node tools/make-test-pack.mjs` produces the three maps and the sheet; a unit test checks
  file existence and JSON validity (the converter test is in A-07).
- Visual proof: a contact sheet PNG of all Thumbtack frames attached to the PR.

**Acceptance criteria.** `ART.md` and `LICENSE-ART.md` exist and `pack.json.license.name`
is `CC0-1.0` (asserted); `sheet.png` under 150 KB; every animation in
`02-avatar.md` §9.1 exists; each `point-*` animation leans at least 15° (asserted from
`frames.mjs`).

**Depends on.** A-01.

---

## A-04 Speaker layout in the engine and the `SpeakerPresenter`

**Goal.** Build the bubble + avatar slot natively in the popover renderer, make the arrow
math use the bubble, and implement `SpeakerPresenter` on top of that: dock the avatar,
keep the dialog semantics, no post-positioning fix-ups.

**PRD requirements covered.** AV-8, AV-10, X-1 (dialog semantics in avatar mode).

**Files in the fork.**
- Engine: `src/engine/popover/popover.ts` (`PopoverRenderOptions.layout`,
  `createPopover(layout)` building the structure in `02-avatar.md` §4.1,
  `PopoverDOM.bubble` and `avatarSlot`, `insertRow` (120-127) targets `bubble ?? wrapper`,
  `toggleButton`'s `closest('.vt-popover')` unchanged); `src/engine/popover/position.ts`
  (`renderPopoverArrow` (247-289) measures `popover.bubble ?? popover.wrapper` and shifts
  the inline offset by the bubble's position in the wrapper; side arrows get explicit
  `left`/`right` px instead of relying on the `100%` rule; `RepositionInfo.bubbleRect`);
  `src/engine/tour/step.ts` (`resolveStepPopover` passes `layout` from the presenter);
  `src/engine/types.ts` (`EnginePresenter.layout`).
- Public: `src/avatar/speaker.ts`, `src/styles/avatar.css`, `test/avatar/speaker.test.ts`,
  `test/engine/speaker-layout.test.ts`, `e2e/avatar-layout.spec.ts`,
  `e2e/engine/speaker-arrow.spec.ts`, `demo/fixtures/avatar-layout.html`.

**Public API added.** `AvatarOptions.dock`, `AvatarOptions.scale`, per-step
`extensions.avatar.dock` and `extensions.avatar.hidden`. CSS classes `vt-speaker`,
`vt-bubble`, `vt-avatar-slot`, `vt-avatar`, `vt-bubble-tail`; data attributes
`data-vt-dock`, `data-<ns>-side`.

Rules: `02-avatar.md` §4.1–§4.3.
- `SpeakerPresenter.layout = 'speaker'`. `mount(popover, step, parts)`: append
  `parts.body` after `popover.description` and `parts.footer` after `popover.footer`
  (both inside the bubble, because the engine built them there); move the player's
  `.vt-avatar` element into `popover.avatarSlot` (created once); set `data-vt-dock`; set
  `vt-speaker--no-avatar` when `extensions.avatar.hidden` is true (the slot stays empty).
- `afterReposition(popover, step, info)`: copy `info.side` into `data-<ns>-side`; for
  `dock: 'auto'` choose the dock from `info.targetRect` and the boundary, and when it
  changes call `tour.refresh()` once (flag reset on the next step).
- `update()`: nothing structural (the engine inserts instruction/feedback rows inside the
  bubble itself).
- RTL (`isRtl` from `engine/core/env.ts`): default dock mirrors.
- `avatar.css` per `02-avatar.md` §4.1: `.vt-speaker` resets the popover box styles and lays
  out with flex by `data-vt-dock` and `data-<ns>-side`; `.vt-bubble` carries the box styles;
  `position`, `z-index`, and the layer rules are inherited from `base.css`.

**Tests/proof required.**
- Unit engine `speaker-layout.test.ts`: `layout: 'speaker'` produces the §4.1 structure;
  `PopoverDOM` references point at elements inside the bubble; `updatePopover({ title })`
  updates the title inside the bubble; an instruction row is inserted inside the bubble
  before the footer; with stubbed rects the arrow's `left` equals the bubble-relative
  offset plus the bubble's offset in the wrapper for each side; `layout: 'dialog'` output
  is unchanged (ported snapshot).
- Unit public `speaker.test.ts`: the same `.vt-avatar` element is present in the second
  step's slot; `hidden: true` renders no avatar; RTL mirrors the default dock; `aria-*`
  attributes; `dock: 'auto'` calls `refresh()` at most once per step.
- e2e (3 browsers): for each side and both docks, the tail's center lies on the bubble's
  target-facing edge within 1 px and within the target's span; the avatar never overlaps
  the bubble's text (`.vt-avatar` and `.vt-popover-description` rects do not intersect);
  near the boundary the engine's flip keeps the whole speaker (avatar included) inside;
  with `dim: true` `elementFromPoint` on the avatar returns the avatar; after
  `window.scrollBy(0, 300)` the tail is still on the bubble's edge; in an RTL fixture the
  dock mirrors; a step inside an open `<dialog>` shows the speaker above the dialog;
  screenshots attached.

**Acceptance criteria.** `getByRole('dialog', { name })` finds the speaker by the step title;
the avatar has `aria-hidden="true"`; the core size report changes by less than 500 bytes
(the layout branch only).

**Depends on.** A-02, V-05, V-07, F-08.

---

## A-05 `withAvatar()` and per-step animation selection

**Goal.** Wire the presenter into a tour, play the right animation per step (explicit name,
role, or direction-aware pointing), react to nudges, completions, and waiting, and handle
first/last step defaults and pack failure.

**PRD requirements covered.** AV-4, AV-9 (`withAvatar` and fallback), T-3 (avatar
extension merging).

**Files in the fork.** `src/avatar/index.ts` (`withAvatar`), `src/avatar/speaker.ts`
(animation selection in `afterShow`/`afterReposition`/`onNudge`/`onCompleted`),
`test/avatar/selection.test.ts`, `e2e/avatar-steps.spec.ts`, `demo/fixtures/avatar-steps.html`.

**Public API added.** `withAvatar(pack, opts)`, `AvatarOptions` (full), per-step
`extensions.avatar.animation`.

Rules: `02-avatar.md` §4.4, §6, §7. Selection order: explicit `animation` (name or role;
`point.left` style role paths allowed) → first step without a target → `greet` → step with
a target → `point.<dir>` → otherwise `opts.defaultAnimation` or `rest`. The pointing
animation starts after the engine's fade (`dim.transitionMs`, default 400 ms; 0 when
`animate` is off or reduced motion is on). `onNudge` → `alert`; `onCompleted` →
`celebrate` once; while the wrapper has `vt-waiting` → `think` loop. On `finished`,
the avatar is removed immediately when the tour ends: no farewell animation in the MVP
(maintainer, 2026-11-13), so `celebrate` does not play on `finished`.
If the pack promise rejects: `console.warn` in dev, `opts.onError`, and the tour uses
`DialogPresenter` for the run.

**Tests/proof required.**
- Unit: selection table; direction from vectors (ties go horizontal); rejected pack →
  dialog presenter and `onError` called once; `stepDefaults.extensions.avatar` merges with
  step-level values; on `finished` the avatar is removed immediately (no deferral);
  `tour.nudge()` plays `alert`; an action step completion plays `celebrate` then returns
  to `rest`.
- e2e (3 browsers): a 4-step tour: step 1 no target → `data-vt-anim="wave"` (the player
  sets `data-vt-anim` on the avatar element); step 2 target to the right of the speaker →
  `point-right`; step 3 explicit `think` → loops across 1 s; step 4 an action step: Next
  while unmet → `boing`; clicking the target → `cheer`.

**Acceptance criteria.** `shown` fires without waiting for the animation; animations never
block navigation.

**Depends on.** A-04, V-06.

---

## A-06 Idle loop and reduced motion end-to-end

**Goal.** Add the idle scheduler and verify reduced motion across player, idle, entrance,
engine fade, and the cut-out in avatar mode.

**PRD requirements covered.** AV-5, AV-6, X-5.

**Files in the fork.** `src/avatar/idle.ts`, `src/avatar/speaker.ts` (arm/disarm),
`test/avatar/idle.test.ts`, `e2e/avatar-motion.spec.ts`.

**Public API added.** `AvatarOptions.idle`, `AvatarOptions.idleQuietMs`, per-step
`extensions.avatar.idle`.

Rules: `02-avatar.md` §5 and §8.

**Tests/proof required.**
- Unit (fake timers): fires after `quietMs`; picks a different idle than the last; re-arms
  after playback; `disarm` in `beforeLeave`; never arms under reduced motion; per-step
  `idle: false`.
- e2e (3 browsers): with `idleQuietMs: 300`, within 1.5 s `data-vt-anim` becomes one of the
  idle names and then returns to `rest`; with `reducedMotion: 'reduce'` `data-vt-anim` stays
  `rest`, `background-position` never changes over 1.5 s, `document.getAnimations()` is
  empty, `<body>` has `vt-simple`, and the overlay path jumps between steps.

**Acceptance criteria.** Idle never interrupts a step animation in progress (the scheduler
arms only after `play` resolves).

**Depends on.** A-05.

---

## A-07 Pack loaders: project format, classic formats, Thumbtack

**Goal.** Load packs from URLs: the v1 format, the two classic formats (with default role
mapping), and the shipped Thumbtack pack.

**PRD requirements covered.** AV-9, AV-7, AV-12 (tests use synthetic packs only).

**Files in the fork.** `src/avatar/classic.ts`, `src/avatar/index.ts`
(`loadAvatarPack`, `loadClassicAvatarPack`, `thumbtackPack`), `test/avatar/classic.test.ts`,
`test/avatar/loaders.test.ts`, `e2e/avatar-classic.spec.ts` (serves
`e2e/fixtures/test-pack/`).

**Public API added.** `loadAvatarPack`, `loadClassicAvatarPack`, `thumbtackPack`, types
`RoleMap`, `ClassicSource`.

Rules: `02-avatar.md` §6 and `03-schemas.md` §2.4. Format detection: an array whose items
have `Name` and `Frames` → Format A; an object with `animations` and
(`frameWidth`/`frameHeight` or `framesize`) → Format B; otherwise `AvatarPackError`.
Format A needs `frameSize` from the caller or the image size divided by the max column/row
counts. Null `ImagesOffsets` frames are dropped; `images: [[x, y], ...]` uses the first
entry; `sound`, `branching`, `exitBranch` ignored. Default roles per the table. The
converted pack gets `license: { name: 'unknown', attribution: 'Supplied by the integrator' }`
and dev builds log it once (`13-licensing.md` §6).
`thumbtackPack(baseUrl)` → `loadAvatarPack(new URL('thumbtack/pack.json', baseUrl ?? import.meta.url))`.

**Tests/proof required.**
- Unit: Format A fixture converts with the expected frame count and role mapping; Format B
  likewise (both the `position` and `images` spellings); null offsets dropped; sound fields
  ignored; unknown shape throws; `frameSize` inferred from a stubbed image.
- e2e (3 browsers): load `classic-a.json` and `classic-b.json` with the synthetic sheet
  through `loadClassicAvatarPack` and run a two-step tour; animations play (sampled
  `background-position` changes); `thumbtackPack()` loads from the built `dist/` in the demo
  and the tour runs with the character visible (screenshot attached).

**Acceptance criteria.** The repository contains no third-party character sheet or map
(a unit test scans `e2e/fixtures`, `src/avatar`, and `docs/` for PNGs larger than 200 KB,
JSON files with 40 or more animations, and file names containing "clippy", "clippit", or
"office-assistant").

**Depends on.** A-01, A-03, A-05.

---

## A-08 Avatar styles, size report, fallback hardening, avatar accessibility audit

**Goal.** Finish `avatar.css`, add the avatar entry to the size report, harden failure paths
(missing CSS, slow pack, pack load after the tour started), and extend the V-09 audit to
avatar mode.

**PRD requirements covered.** AV-11, AV-9, ST-2 (avatar stylesheet marker), X-6 (avatar
default colors), AV-8, X-1..X-5 in avatar mode.

**Files in the fork.** `src/styles/avatar.css`, `tools/size-report.mjs` (avatar soft
target 6 KB, assets excluded), `src/avatar/index.ts`, `test/avatar/fallback.test.ts`,
`e2e/avatar-fallback.spec.ts`, `e2e/a11y.spec.ts` (avatar cases added).

**Public API added.** `AvatarOptions.loadTimeoutMs` (default 3000).

Rules: `.vt-speaker { --vt-avatar-base: 1 }` marker so the ST-2 warning covers
`avatar.css`; the bubble's default colors meet 4.5:1; a pack that resolves after the first
step is shown upgrades the next step (the current step stays a dialog); a pack that never
resolves does not block `start()` (dialog mode after `loadTimeoutMs`).

**Tests/proof required.**
- Unit: load timeout → dialog mode and `onError`; late resolve upgrades on the next step;
  missing `avatar.css` warns once in dev.
- e2e (3 browsers): a tour whose pack URL 404s runs as dialogs with no console error (one
  `console.warn`); a tour whose pack is delayed 1 s shows step 1 as a dialog and step 2 as a
  speaker; the accessibility engine reports zero violations on a titled speaker step, an
  untitled labeled speaker step, a centered speaker step, and an action speaker step;
  keyboard-only completion of a 4-step avatar tour; the live region announces the new
  title after `configure()`.
- Size report: `avatar.js` reported; core delta since V-09 under 500 bytes.

**Acceptance criteria.** All avatar e2e specs pass on chromium, firefox, webkit, and edge in
the matrix run.

**Depends on.** A-06, A-07, V-09.
