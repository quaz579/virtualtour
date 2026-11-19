# 02. Avatar subsystem

The avatar is a pluggable slot. The core public API knows nothing about avatars; it only
exposes the `Presenter` extension point (`01-architecture.md` §8). The `./avatar` entry
provides a presenter that renders an animated character next to a speech bubble, and the
bubble carries the step's content. The plain dialog remains the default ("no-avatar mode").

Because the engine is forked, the speaker is **built natively by the popover renderer**:
`createPopover(layout)` in `src/engine/popover/popover.ts` builds the bubble and the avatar
slot when the presenter asks for `layout: 'speaker'` (task A-04), and
`renderPopoverArrow` in `src/engine/popover/position.ts` measures the bubble, not the
wrapper, when a bubble exists. So the avatar is placed, flipped, clamped to the boundary,
scrolled into view, and layered inside `<dialog>`s by the engine, and the arrow lands on the
bubble's edge with no second pass. The layered design's "restructure the popover from
`onPopoverRender` and re-place the arrow from a MutationObserver" is gone.

Decisions this design follows (all owner decisions of 2026-11-12):

- Pluggable avatar slot; the project ships one original character, **Thumbtack**, drawn by
  code, permanently (§9 and `13-licensing.md` for why not openclippy).
- Avatar format: sprite sheet image + JSON animation map, in the same general shape the
  classic Office-assistant packs use (frame grid, named animations, per-frame duration),
  so a user can load such a pack themselves. The project never ships one.
- v1 behavior: per-step animation name, idle loop, reduced motion respected, no sound.
- The bubble points at the target (the engine's arrow is the tail); the avatar sits beside
  the bubble and plays a direction-aware "point" animation toward the target.

---

## 1. Avatar requirements (AV-*)

| ID | Requirement |
|---|---|
| AV-1 | An avatar pack is a sprite sheet image plus a JSON animation map (`03-schemas.md` §2). The map names animations; each animation is a list of frames with a grid position and a duration in ms, plus an optional loop flag and optional still frame. |
| AV-2 | The sprite player plays a named animation, resolves a promise when it ends, can stop, can loop, and can show a single still frame. Frame changes are driven by one `requestAnimationFrame` loop, not by nested timers. |
| AV-3 | Packs declare roles: `rest`, `idle` (list), `greet`, `point` (left/right/up/down), `think`, `celebrate`, `exit`, `alert`. A role maps to one or more animation names. Missing roles fall back to `rest`. |
| AV-4 | A step can name an animation or a role (`extensions.avatar.animation`), played when the step is shown. Default per step: the `point` role in the direction of the target; `greet` on the first step when it has no target; `celebrate` on the last step when finishing; `alert` when `tour.nudge()` runs or an action step is nudged by the engine; `think` while a step waits for its target. |
| AV-5 | Idle loop: after a configurable quiet time (default 6 s) while a step is shown, a random `idle` animation plays, then the player returns to `rest` and waits again. The same idle animation is not picked twice in a row. |
| AV-6 | Reduced motion: when the user prefers reduced motion, no animation plays. The player shows the animation's still frame (or frame 0) and switches stills per step. The engine turns its own fade and tween off under reduced motion (F-14), so nothing else needs to be done. |
| AV-7 | No sound in v1. Sound fields in classic maps are ignored. |
| AV-8 | The avatar is decorative for assistive technology (`aria-hidden="true"`); the bubble is the dialog and holds the accessible name and all content. Keyboard behavior is identical to dialog mode (it is engine code). |
| AV-9 | Pack loading: `loadAvatarPack(url)` fetches a pack JSON and preloads its sheet; `loadClassicAvatarPack({sheetUrl, mapUrl})` converts the two classic map formats; `thumbtackPack()` resolves the shipped character. Loading failures reject with `AvatarPackError` and the tour falls back to dialog mode with a dev warning. |
| AV-10 | The speaker (avatar + bubble) is positioned as one box by the engine; flip, shift, boundary, and clamping apply unchanged. The avatar docks at the bubble's inline-end by default (`dock: 'start' \| 'end' \| 'auto'`), honoring RTL (engine `isRtl`, F-08). |
| AV-11 | The avatar entry adds no runtime dependency and is not counted in the core size target. Its own soft target is 12 KB min+gzip excluding the Thumbtack assets, counted with the presenter chunk it shares with core. |
| AV-12 | The project repository, package, docs, demo, and tests contain no third-party character art. Test packs are synthetic (generated colored shapes) or Thumbtack. |

---

## 2. Module layout (`packages/core/src/avatar/`)

| File | Role |
|---|---|
| `index.ts` | public exports: `withAvatar`, `loadAvatarPack`, `loadClassicAvatarPack`, `thumbtackPack`, `SpritePlayer`, types, `AvatarPackError` |
| `pack.ts` | `AvatarPack` type, `validatePack()`, `normalizePack()` (fills `columns`, computes frame pixel offsets, resolves roles), `preloadSheet()` |
| `classic.ts` | `fromClassicColumnRowMap()` and `fromClassicPositionMap()` converters (§6), ignoring sound/branching |
| `player.ts` | `SpritePlayer` (§3) |
| `idle.ts` | `IdleScheduler` (§5) |
| `speaker.ts` | `SpeakerPresenter` implementing `Presenter` with `layout: 'speaker'` (§4) |
| `thumbtack/` | `pack.json`, `sheet.png`, `svg/` sources, built by `tools/build-thumbtack-pack.mjs` |

Styles live in `styles/avatar.css` (published as `./avatar.css`). The avatar entry imports
`dom/frame.ts` and `engine/core/env.ts` from the core source; the build marks the core entry
`external` for the avatar bundle so nothing is duplicated.

Engine-side pieces the speaker depends on (all built in A-04, inside `src/engine/`):

| Engine change | File |
|---|---|
| `PopoverRenderOptions.layout?: 'dialog' \| 'speaker'` and `createPopover(layout)` | `popover/popover.ts` |
| `PopoverDOM.bubble?: HTMLElement`, `PopoverDOM.avatarSlot?: HTMLElement` | `popover/popover.ts` |
| `insertRow` inserts instruction/feedback rows into `bubble ?? wrapper` (`popover.ts:120-127`) | `popover/popover.ts` |
| `renderPopoverArrow` measures `popover.bubble ?? popover.wrapper` (`position.ts:261`) and offsets the arrow by the bubble's position inside the wrapper | `popover/position.ts` |
| `RepositionInfo.bubbleRect` | `popover/position.ts`, `types.ts` |

---

## 3. Sprite player (AV-2, AV-6)

### 3.1 Element

A single `<div class="vt-avatar" aria-hidden="true">` with inline styles:

```
width: <frameWidth>px; height: <frameHeight>px;
background-image: url(<sheet>); background-repeat: no-repeat;
background-position: -<x>px -<y>px;     /* current frame */
image-rendering: pixelated;             /* only when pack.pixelArt is true */
```

Optional `scale` (AvatarOptions) applies `transform: scale(n)` with `transform-origin`
at the docked corner; the speaker layout accounts for the scaled box by setting the
element's `width/height` to the scaled size so the engine measures it correctly.

The element is created once per presenter and **moved** into each new popover's
`avatarSlot` (the engine re-creates the wrapper on every step), so the player keeps its
state and no image decode repeats.

### 3.2 API

```ts
class SpritePlayer {
  constructor(pack: NormalizedPack, el: HTMLElement, opts?: { reducedMotion?: () => boolean });
  play(name: string, opts?: { loop?: boolean }): Promise<void>;  // resolves when a non-loop animation ends, or on stop()
  playRole(role: AvatarRole, dir?: 'left' | 'right' | 'up' | 'down'): Promise<void>;
  stop(): void;                   // stops immediately and shows `rest`
  still(name: string): void;      // shows the animation's still frame
  readonly current: string | null;
  dispose(): void;
}
```

### 3.3 Timing

- Uses `dom/frame.ts` (the tiny rAF scheduler): on `play`, record
  `startedAt = performance.now()`, build a cumulative duration table, and on every frame
  pick the frame whose cumulative range contains `elapsed`. Drops frames when the tab is
  busy instead of queuing; no `setTimeout` drift.
- Loop: `elapsed % total`. Non-loop: on reaching the end, show the last frame (or the
  `still` frame if defined), resolve the promise, release the frame subscription.
- `play` while another animation runs: the running one stops (its promise resolves) and
  the new one starts.
- Document hidden (`visibilitychange`): on return, `startedAt` is shifted by the hidden
  duration so a one-shot animation does not jump to its end.
- `reducedMotion()` true: `play` shows the still frame and resolves immediately.

---

## 4. Speaker layout: bubble, avatar, and the arrow (AV-10)

### 4.1 Structure

In dialog layout the engine builds this wrapper (`popover.ts:372-415`, class names after
F-03):

```
<div class="vt-popover" role="dialog" aria-labelledby=… aria-describedby=…>
  <button class="vt-popover-close-btn">
  <div class="vt-popover-arrow">
  <div class="vt-popover-title">
  <div class="vt-popover-description">
  <div class="vt-popover-footer">…progress + prev/next…</div>
</div>
```

With `layout: 'speaker'` (the presenter declares it; `resolveStepPopover` passes it to
`renderPopover`), `createPopover` builds instead:

```
<div class="vt-popover vt-speaker" data-vt-dock="end">      <!-- the engine measures and moves this box -->
  <div class="vt-popover-arrow vt-bubble-tail"></div>       <!-- direct child of the wrapper; positioned relative to the bubble -->
  <div class="vt-bubble">                                    <!-- PopoverDOM.bubble: the visible bubble -->
    <button class="vt-popover-close-btn">
    <div class="vt-popover-title">
    <div class="vt-popover-description">
    <div class="vt-body">              (non-string bodies, added by the presenter parts)
    <div class="vt-popover-instruction"> (added later by insertRow, inside the bubble)
    <div class="vt-popover-footer">
    <div class="vt-footer">            (custom buttons)
  </div>
  <div class="vt-avatar-slot"></div>                         <!-- PopoverDOM.avatarSlot: the presenter moves .vt-avatar here -->
</div>
```

`PopoverDOM` references point at the same elements in both layouts, so
`applyPopoverContent` (`popover.ts:182-221`) and `updatePopover` work unchanged. The arrow
stays a direct child of the wrapper because the engine positions it with inline `left/top`
px relative to the wrapper (`position.ts:247-289`); after A-04 those values are computed
against the bubble's rect and then shifted by the bubble's offset inside the wrapper, so the
tail sits on the bubble's edge, never under the avatar.

`avatar.css`: `.vt-speaker { display: inline-flex; align-items: flex-end;
gap: var(--vt-avatar-gap, 8px); background: transparent; box-shadow: none; padding: 0;
max-width: none }` (overriding the popover box styles in `base.css`), `flex-direction`
from `data-vt-dock` and `data-vt-side`; `.vt-bubble` carries the box styles the popover
normally has (padding, background, radius, shadow, min/max width). `position`, `z-index`,
and the layer rules stay as `base.css` sets them on `.vt-popover`.

### 4.2 Dock

`AvatarOptions.dock`: where the avatar sits relative to the bubble.

| Final side (from `RepositionInfo.side`) | `dock: 'end'` (default) | `dock: 'start'` |
|---|---|---|
| `top` / `bottom` | avatar at the bubble's inline-end edge, bottom-aligned with the bubble (RTL: inline-end is the left) | inline-start edge |
| `left` / `right` | avatar below the bubble, aligned to the bubble's inline-end (RTL mirrored) | above the bubble |
| `over` (centered) | avatar at inline-end, bottom-aligned | inline-start |

`dock: 'auto'`: for `top`/`bottom`, choose the inline side with more free boundary space
next to the target (`targetRect` and the boundary from `RepositionInfo`); for `left`/`right`,
below unless that overflows the boundary, then above. Because the dock changes the box size
and the engine has already positioned the box, an `auto` dock change calls `tour.refresh()`
once (guarded by a flag so it cannot loop).

### 4.3 The arrow (bubble tail) after each reposition

Engine code (A-04): `renderPopoverArrow(popover, side, alignment, elementRect)` uses
`const box = popover.bubble ?? popover.wrapper` for `popoverRect` (`position.ts:261`), runs
the unchanged `calculateArrowTarget`/`calculateArrowOffset` math against the bubble's length,
and then adds `bubbleRect.left - wrapperRect.left` (or `.top`) to the inline offset because
the arrow's `left`/`top` are relative to the wrapper. For a side arrow (`left`/`right`
class), the arrow's `left: 100%` / `right: 100%` from the stylesheet refers to the wrapper's
edge; `avatar.css` overrides those for `.vt-speaker .vt-bubble-tail` with values computed in
the same function (`style.left = bubbleRight - wrapperLeft`). If the target no longer
overlaps the bubble span, `resolveArrowSide` (`position.ts:225-245`) already picks the
facing side. Nothing runs outside the engine's own reposition pass; scroll and resize go
through `refreshActiveHighlight` → `repositionStepPopover` as before.

### 4.4 Pointing animation choice (AV-4)

In `afterShow` and again in `afterReposition` when the side changes: compute the vector
from the avatar's center to the target's center (`info.targetRect`, null for centered
steps). Pick `point` direction by dominant axis: `|dx| >= |dy|` → `left`/`right` else
`up`/`down`. If the step sets `extensions.avatar.animation`, that wins. Pack roles decide
which animation name plays; packs without a `point.<dir>` entry fall back to `point.any`,
then `greet`, then `rest`.

The animation plays after the engine's entrance fade (`dim.transitionMs`, default 400 ms;
0 when `animate` is off or reduced motion is on), so it is not clipped by the fade; the
step's `shown` event does not wait for it.

Action steps: while the instruction is unmet the avatar stays on `rest` after pointing;
on `nudge` (engine `tour/nudge.ts` or `tour.nudge()`) it plays `alert`; on `completed` it
plays `celebrate` once, then `rest`. While a step waits for its target (`vt-waiting`) it
loops `think`.

### 4.5 Entrance/exit motion

The engine fades the popover in with `<ns>-fade` on `<body>` (`driver.css:55-57`, data
attribute after F-03). `avatar.css` adds a short scale on `.vt-speaker` under the fade
state, guarded by `@media (prefers-reduced-motion: no-preference)` and absent when
`animate` is off. The core `glide()` add-on (V-12) works with speakers because it moves the
wrapper.

---

## 5. Idle loop (AV-5)

`IdleScheduler(player, pack, opts: { quietMs = 6000, reducedMotion })`:

- `arm()` on `afterShow` (after the pointing animation resolves) and after any played
  animation ends; `disarm()` in `beforeLeave` and on tour end.
- On fire: pick a random `idle` role animation different from the last one; `play` it;
  when it ends, show `rest` and `arm()` again.
- Reduced motion: the scheduler never arms.
- Uses one `setTimeout` for the quiet period (coarse timing is fine) and the frame scheduler
  for playback.

---

## 6. Pack loading API (AV-9)

```ts
loadAvatarPack(url: string, opts?: { fetch?: typeof fetch; signal?: AbortSignal }): Promise<AvatarPack>
```
Fetches JSON, validates against the v1 pack shape (`03-schemas.md` §2), resolves
`sheet.src` relative to the pack URL, preloads the image (`new Image()` + `decode()`),
returns a normalized pack.

```ts
loadClassicAvatarPack(src: {
  sheetUrl: string;
  mapUrl: string;
  name?: string;
  frameSize?: { w: number; h: number };  // required for the column/row format
  roles?: Partial<RoleMap>;              // defaults in 03-schemas.md §2.4
}): Promise<AvatarPack>
```
Accepts both classic map formats (detected by shape), converts them, assigns default role
mappings by well-known animation names, and preloads the sheet. Both files come from URLs
the integrator controls; the library ships neither. Sound and branching fields are ignored.

```ts
thumbtackPack(baseUrl?: string): Promise<AvatarPack>
```
Resolves the shipped pack. Default `baseUrl` is `import.meta.url`-relative so bundlers
copy the assets; a CDN or self-hosted base can be passed.

```ts
withAvatar(pack: AvatarPack | Promise<AvatarPack>, opts?: AvatarOptions): PresenterFactory

interface AvatarOptions {
  dock?: 'start' | 'end' | 'auto';   // default 'end'
  scale?: number;                     // default 1
  idleQuietMs?: number;               // default 6000
  idle?: boolean;                     // default true
  defaultAnimation?: string;          // used when a step has no target and is not first/last
  loadTimeoutMs?: number;             // default 3000: start in dialog mode if the pack is slower
  onError?: (err: AvatarPackError) => void;
}
```

Usage:

```ts
import { createTour } from 'virtualtour';
import { withAvatar, thumbtackPack } from 'virtualtour/avatar';
import 'virtualtour/base.css';
import 'virtualtour/avatar.css';

const tour = createTour({
  presenter: withAvatar(thumbtackPack()),
  steps: [
    { title: 'Welcome', body: 'Hi, I am Thumbtack.', extensions: { avatar: { animation: 'greet' } } },
    { target: '#save', placement: { side: 'bottom' }, body: 'Save here.' },
  ],
});
```

If the pack promise rejects before the first step shows, the tour logs a dev warning,
calls `opts.onError`, and uses the dialog presenter for that run.

---

## 7. Per-step avatar options

```ts
extensions: {
  avatar: {
    animation?: string;          // animation name or role name ("greet", "point.left", "think")
    idle?: boolean;              // override idle loop for this step
    dock?: 'start' | 'end' | 'auto';
    hidden?: boolean;            // show a plain bubble without the character for this step
  }
}
```

Core deep-merges `stepDefaults.extensions.avatar` into steps like any nested group (T-3).

---

## 8. Reduced motion summary (AV-6, X-5)

| Feature | Motion on | Reduced motion |
|---|---|---|
| Step animation (`point`, `greet`, ...) | plays once | still frame only |
| Idle loop | random idle after quiet period | off |
| Engine fade-in and cut-out tween | on (`animate: true`) | off: the engine checks `prefersReducedMotion()` itself (F-14) |
| Speaker entrance scale | on | none (`@media` guard) |
| Nudge shake | shake | flash (engine CSS already does this, `driver.css:118-128`) |
| Glide add-on | moves | jump |

`prefersReducedMotion()` (`engine/core/env.ts`) is read before each step show so a mid-tour
OS change takes effect.

---

## 9. Thumbtack: the shipped original character

Thumbtack is a push pin with two round eyes and expressive eyebrows. It is an office-supply
mascot in the same genre as the famous paperclip, but it is a different object with
independently drawn art. It is not a paperclip, has no wire loops, and does not copy the
paperclip's eye shape, eyebrows, or poses. The parody is in the premise (an eager office
supply that offers help), not in the drawing. See `13-licensing.md` §4 for the line this
must stay on.

### 9.1 Art pipeline (provenance in git)

Decided 2026-11-12: **Thumbtack is drawn by code, and that is the final approach.** The
parametric SVG pipeline below is the 1.0 art, not a stand-in for a later illustrator. All
quality effort goes into the parameters (shapes, easing of tilts, eye and eyebrow poses)
and the quality bar in §9.2.

- Source: `avatar/thumbtack/svg/<animation>/<frame>.svg`, generated by
  `tools/build-thumbtack-pack.mjs` from a small parametric SVG (pin body, head, eyes,
  eyebrows, tilt angle, blink state) described in `avatar/thumbtack/frames.mjs`.
  Generated frames are committed too, so the history shows the art being created in this
  project.
- `tools/build-thumbtack-pack.mjs` rasterizes every SVG frame with Playwright's bundled
  Chromium (already a dev dependency) at 2x and packs them into `sheet.png` on a grid of
  `frameWidth x frameHeight` (proposal: 96 x 96 CSS px, 192 x 192 device px, `pixelArt: false`),
  and writes `pack.json` with the frame table and roles.
- Frame budget for v1 (keeps the sheet small, about 60 frames):

| Animation | Frames | Loop | Role |
|---|---|---|---|
| `rest` | 1 | no | rest |
| `blink` | 4 | no | idle |
| `wobble` | 8 | no | idle |
| `look-around` | 8 | no | idle |
| `wave` | 8 | no | greet (the pin tilts and the head bobs) |
| `point-left` / `point-right` / `point-up` / `point-down` | 6 each | no | point.* (lean toward the side, eyes follow) |
| `think` | 6 | yes | think |
| `cheer` | 8 | no | celebrate |
| `pop-out` | 6 | no | exit |
| `boing` | 6 | no | alert |

- Colors: `--thumbtack-head: #e5484d`, `--thumbtack-pin: #9aa4b2`, eyes white with dark
  pupils. Any palette is fine; these are placeholders.
- License for the art: **CC0 1.0** (decided 2026-11-12), separate from the MIT code
  license; `src/avatar/thumbtack/LICENSE-ART.md` carries the dedication and `pack.json`
  says `"license": { "name": "CC0-1.0", ... }` (`13-licensing.md` §7).

### 9.2 Quality bar

- Reads clearly at 96 px and at 64 px (`scale: 0.66`).
- Every animation starts and ends on the `rest` pose so cuts between animations do not jump.
- Each `point-*` frame set leans at least 15° toward its direction so the pointing is
  legible without a hand.

---

## 10. Accessibility in avatar mode (AV-8)

- The wrapper keeps the engine's `role="dialog"`; the accessible name is set by the engine
  the same way in both layouts (`label`, V-05). The avatar is `aria-hidden="true"` and holds
  nothing focusable, so the focus trap and announcements are unchanged.
- Contrast and focus visibility in `avatar.css` meet WCAG 2.2 AA for the default colors.
- The bubble tail and avatar never overlap the bubble's text (asserted in A-04's e2e).
