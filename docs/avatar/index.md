# Avatar

`virtual-site-tour/avatar` replaces the dialog with a speech bubble and an animated character beside it. It is a presenter: you pass it as `presenter` in the tour config, and the rest of the tour behaves the same. This page is a reference for the options and their edge cases. For a walkthrough, read the [avatar guide](./guide). To draw your own character, see [make a pack](./make-a-pack); for the character that ships, see [Thumbtack](./thumbtack).

## Use it

Load `base.css`, then `avatar.css`, and give the tour `withAvatar(pack, options)`. The pack can be a promise.

<<< @/snippets/avatar/with-avatar.ts

The package ships [Thumbtack](./thumbtack) in a push-pin default and a round-top variant, both loaded with `thumbtackPack()`. Anything else goes through `loadAvatarPack(url)`. A classic character map goes through `loadClassicAvatarPack`; see [classic packs](./classic-packs) before you use it. The [licensing](../licensing) page covers the code and the art.

## withAvatar options

`withAvatar(pack, options?)` returns a presenter factory. `pack` is a pack object, a loaded pack, or a promise of either.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `dock` | `'start' \| 'end' \| 'auto'` | `'end'`, or the pack's own hint | Which edge of the bubble the avatar sits on. See [Dock](#dock). |
| `scale` | `number` | `1` | Multiplies the avatar's frame size. A value that is not a positive number counts as 1. |
| `defaultAnimation` | `string` | `rest` | Animation name or role for a step that has no target and is not the first step shown. |
| `idle` | `boolean` | `true` | Plays a random idle animation after a quiet period. |
| `idleQuietMs` | `number` | `6000` | Quiet time before an idle animation. See [Idle](#idle). |
| `loadTimeoutMs` | `number` | `3000` | How long a run waits for the pack and its sheet image. Capped at 9000. |
| `onError` | `(error: AvatarPackError) => void` | none | Called once when the pack or its sheet fails to load or arrives too late. |

### Loading, timeouts and fallback

Each run waits for the pack, up to `loadTimeoutMs`. A value above 9000 counts as 9000, which keeps the wait under the 10 seconds the engine allows a presenter to get ready. A negative or non-numeric value uses the default.

If the pack fails to load, fails validation, or has not arrived when the time is up, that run uses the plain dialog presenter. `onError` is called once for the `withAvatar` call, not once per run. The published avatar entry prints no warning of its own; see [Production-only entry](#production-only-entry).

A pack that arrives late is used from the next run, not from the next step of the run that already started in dialog mode. A run never switches presenters in the middle.

### The first step

The first step a run shows has no earlier step to follow. If it has no target, the avatar plays the `greet` role. If it has a target, the avatar points at it instead, as it does on every step with a target. Later steps without a target play `defaultAnimation`.

## Step options

A step sets avatar behavior under `extensions.avatar`. A value of the wrong type is ignored.

| Key | Type | Meaning |
|---|---|---|
| `animation` | `string` | An animation name, a role (`greet`, `think`) or a role path (`point.left`). It wins over the automatic choice. An unknown name falls back to the automatic choice. |
| `dock` | `'start' \| 'end' \| 'auto'` | Dock for this step. |
| `idle` | `boolean` | Turns the idle loop on or off for this step. It wins over the tour's `idle`. |
| `hidden` | `boolean` | Leaves the avatar out of this step. The bubble stays. |

<<< @/snippets/avatar/step-extensions.ts

## Idle

When a step's animation ends, the avatar holds that animation's still frame and a timer starts. When it fires, the avatar plays a random animation from the pack's `idle` role, never the same one twice in a row, then returns to rest and waits again.

- `idleQuietMs` defaults to 6000. A value of zero or less, or one that is not a finite number, uses 6000. A smaller positive value is raised to 50, and one above 2147483647 (about 24 days) is capped there.
- Any step animation, a nudge reaction or leaving the step cancels the timer.
- Idle never starts under reduced motion, or when the pack has no `idle` role.
- If an idle animation fails to play, idle pauses (with one development warning) until the avatar next comes to rest.
- Set `idle: false` on the tour or on a step to turn it off.

## Dock

The avatar sits on one edge of the bubble: `start` or `end`. Both are inline directions, so they mirror on a right-to-left page. With `dock: 'auto'` the presenter reads `rtl` and `pinned` from the reposition info, and a pinned popover is treated as centered. The effective dock comes from, in order, the step's `extensions.avatar.dock`, the tour's `dock`, the pack's own hint, and `end`.

`auto` picks an edge from the room around the target:

- With the bubble above or below the target, it docks on the side with more room beside the target.
- With the bubble beside the target, it keeps `end` unless the avatar would then push the bubble off the bottom of the viewport, and then uses `start`.
- With no target or a centered step, it uses `end`.

A switch between layouts can make the engine reposition once or twice. The presenter limits itself to two refreshes per step.

### Caveats

- **Explicit sides fall back in a fixed order.** When the requested side does not fit and `flip` is on, the engine tries left, right, top, then bottom (right, left, top, bottom on a right-to-left page). A step that asks for `bottom` near the bottom of the page lands beside the target, not above it.
- **`end` near the bottom edge.** When a bottom placement flips beside a target near the bottom of the viewport, an `end` dock can leave the bubble and its tail facing away from the target. Use `dock: 'auto'` for tours that point at things near the bottom.
- **The speaker layout keeps its own progress styling.** The `data-vt-progress-bar` bar from `theme.css` is hidden in this layout.

## Reduced motion

With `prefers-reduced-motion: reduce`, the avatar does not animate. A step's animation shows its still frame instead: the frame the pack names, or the first frame for a looping animation and the last frame for any other. The idle loop never starts, and the wait for the engine's entrance fade is skipped.

## Styles

`avatar.css` styles the speaker layout and must load after `base.css`. It sets a custom property, `--vt-avatar-base`, on the speaker popover as a marker. The first time the presenter mounts a step, it reads that property, and when it is empty it warns once that the stylesheet is missing. Because of the production-only entry below, that warning shows only when you bundle the library from source.

The avatar element is decorative and carries `aria-hidden`. The bubble keeps the dialog's name, description, buttons and focus handling; the avatar adds nothing a screen reader reads.

## Production-only entry

The avatar entry is published as a single production build. The package has no development build of it, so none of its development warnings can appear from the published code: the missing-stylesheet warning above, the console warnings for a pack that failed to load, and the warning for an unknown animation name. Use `onError` to see a failed pack in production, and check that `avatar.css` is loaded by looking at the page.

## SpeakerPresenter

`withAvatar` builds a `SpeakerPresenter` once the pack is ready. You can build one yourself when you already hold a loaded pack:

<<< @/snippets/avatar/speaker-presenter.ts

`new SpeakerPresenter(tour, pack, options)` takes the same display options as `withAvatar` (`dock`, `scale`, `defaultAnimation`, `idle`, `idleQuietMs`) plus three more:

| Option | Meaning |
|---|---|
| `namespace` | The tour's `namespace`. Default `vt`. |
| `sanitize` | The tour's `sanitize` hook, applied to custom footer buttons. |
| `fadeMs` | Milliseconds the engine's entrance fade takes. Step animations start after it. Default 0. |

`SpeakerPresenter` does not take `loadTimeoutMs` or `onError`. It is given a loaded pack and has nothing to wait for. Those two belong to `withAvatar`. Pass the `namespace`, `sanitize` and `fadeMs` from the factory's `PresenterContext`, as the snippet does.

It exposes `avatar`, the decorative element, and `player`, the sprite player that runs the animations.

## Loading helpers

| Export | What it does |
|---|---|
| `thumbtackPack(baseUrl?, options?)` | Loads the shipped Thumbtack pack. `options.variant` is `"pushpin"` by default or `"round"` for the round-top look. `baseUrl` is the directory that holds `thumbtack/`; set it to serve the files from a CDN or your own host. |
| `loadAvatarPack(url, { fetch, signal })` | Fetches, validates and normalizes a pack, resolves its sheet image against the pack URL and preloads the sheet. Throws `AvatarPackError` on failure. |
| `loadClassicAvatarPack(source)` | Converts a classic character map and sheet. The result's license is `unknown`. |
| `preloadSheet(url, { signal, timeoutMs })` | Loads and decodes a sheet image so the first frame paints without a flash. Rejects with `AvatarPackError` when the image fails, the signal aborts or `timeoutMs` passes. No time limit when `timeoutMs` is left out. |

<<< @/snippets/avatar/preload.ts

Call it before the user starts the tour so the pack and its sheet are already in the browser's cache when the first run asks for them.

The entry also exports `validatePack`, `normalizePack`, `resolveRole`, `AvatarPackError`, `SpritePlayer` and `IdleScheduler` for code that builds on the pack format.
