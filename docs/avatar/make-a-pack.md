# Make your own pack

A pack is a sprite sheet image plus a JSON file that says how to cut it into frames, which frames make each animation, and which animation does which job. You can draw one in any tool that exports a PNG. The format is called `virtualtour-avatar/1`.

## The sheet

Lay every frame out on a grid of equal cells in one PNG. Frame positions are in CSS pixels, so a sheet drawn for sharp screens is larger than its cells.

| Field | Meaning |
|---|---|
| `sheet.src` | The image. A relative path resolves against the pack file's URL. Required. |
| `sheet.frameWidth`, `sheet.frameHeight` | One frame's size in CSS pixels. Required, greater than 0. |
| `sheet.columns` | Number of columns. Only needed with `scale` other than 1, see below. |
| `sheet.scale` | Image pixels per CSS pixel. Default 1. A sheet drawn at twice the size uses `2`. |
| `sheet.pixelArt` | `true` draws the sheet with `image-rendering: pixelated`. |

A frame is a cell given as `col` and `row` (zero-based grid indices, multiplied by the frame size), or a spot given as `x` and `y` in image pixels (divided by `scale`). Use one pair per frame, never both. `ms` is how long the frame shows and must be greater than 0.

With a `scale` other than 1, give `columns`. The presenter then sizes the sheet from `columns * frameWidth` without waiting for the image. Without `columns` it measures the image once it loads instead.

## The pack file

<<< @/snippets/avatar/blob-pack.json

The top level, `sheet`, each animation and `roles` take only the fields listed here. An unknown field there, including `$schema`, fails validation, so leave `$schema` out of pack files even though editors use the schema to complete them.

| Field | Meaning |
|---|---|
| `format` | Must be `virtualtour-avatar/1`. |
| `name` | Display name, not empty. |
| `version` | The pack's own version string. Optional. |
| `sheet` | See above. |
| `animations` | A name for each animation, with at least one. |
| `roles` | Which animation does which job. |
| `bubble` | Hints: `dock` (`start`, `end` or `auto`) is this character's default dock, and `gap` is the pixels between the bubble and the avatar. |
| `license` | `name`, `url` and `attribution`, all optional strings. Fill it in; it is how people learn what they may do with your art. |

The JSON Schema for editors ships with the package as `virtual-site-tour/schemas/avatar-pack.v1.schema.json`.

## Animations

An animation is a list of `frames`, plus two optional fields:

- `loop`: `true` repeats the animation until something interrupts it. Default `false`.
- `still`: the index of the frame to show under reduced motion and after the animation ends.

Frame order is playback order. An animation with no frames, or a `still` past the last frame, fails validation.

## Roles

A role names the animation that does a job. Every value must be the name of an animation in the pack, or validation fails. Only `rest` is required.

| Role | Used for |
|---|---|
| `rest` | The pose between animations. Required. Every role you leave out plays this. |
| `idle` | One animation name, or an array of them. The presenter picks one at random after a quiet period. |
| `greet` | The first step shown, when it has no target. Also the fallback when a `point` role is missing. |
| `point` | An object with `left`, `right`, `up`, `down` and `any`. The avatar picks the direction toward the target, then `any`, then `greet`, then `rest`. |
| `think` | A step waiting for its target. It loops until the target shows up. |
| `celebrate` | An [action step](../guide/action-steps) was completed. |
| `alert` | The user pressed Next on an unmet action step. |
| `exit` | Accepted and validated, but the presenter does not play it today. |

Steps can also ask for any animation by name, so a pack can hold extras that no role names.

## Reduced motion and still frames

With `prefers-reduced-motion: reduce` the avatar shows one frame per animation. The `still` index picks it. Without `still`, a looping animation shows its first frame and any other shows its last frame. Choose `still` so the frame reads well on its own: a pointing hand, not the wind-up.

## Tips

- **Keep the first frame of `rest` calm.** It is what people see most, and what the avatar returns to after an idle animation, when a step is left and after a nudge reaction.
- **Do not loop step animations.** An animation with `loop: true` runs until something interrupts it, so a step that plays one never starts the idle timer. Loop only `rest` or the `think` animation.
- **Give `point` four directions.** One `any` animation works but looks the same whichever way the target lies.
- **Give `idle` two or more animations.** The picker never plays the same one twice in a row when it has another choice.
- **Keep frames short.** 60 to 100 milliseconds per frame reads as smooth. The sheet is one image the browser must download before the first step, so crop to the character and keep it small.
- **Use one size for every frame.** The avatar slot takes its size from `frameWidth` and `frameHeight`.
- **Mind the dock.** The `bubble.dock` hint sets the character's default edge. The tour's `dock` option and a step's `extensions.avatar.dock` override it.

## Checking a pack

`validatePack(json)` checks parsed JSON and returns it typed. It throws `AvatarPackError` with a path to the first problem, such as `animations.wave.frames[2].ms`. `normalizePack(pack, baseUrl)` turns the frames into pixel offsets and resolves the sheet address.

<<< @/snippets/avatar/make-a-pack.ts

A pack object passed straight to `withAvatar` is validated and normalized when the first run asks for it, and its sheet resolves against the page address. To load a hosted file instead, use `loadAvatarPack(url)`, which also preloads the sheet. See [Loading helpers](./#loading-helpers).

## How Thumbtack is made

Thumbtack has no hand-drawn art. `packages/core/src/avatar/thumbtack/frames.mjs` lists each pose as a few numbers (tilt, nod, squash, pupil position, brows, mouth), and `packages/core/tools/build-thumbtack-pack.mjs` writes an SVG for each frame, draws them onto one sheet and writes `pack.json`. That approach suits a character that is easy to describe with numbers. A character drawn by hand only needs the sheet and the file above. See [Thumbtack](./thumbtack).

## Before you publish a pack

Fill in `license`, and only ship art you made or have the right to share. See [Licensing](../licensing).
