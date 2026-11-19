# Loading a classic paperclip (Clippy) avatar pack (not included)

> **Not included, not open source.** The classic paperclip character and its artwork belong
> to Microsoft Corporation. This project does not ship, host, link to, or license that art.
> The MIT license of this project covers this project's code and its own Thumbtack character
> only. If you load third-party character art with this library, you are responsible for
> having the right to use it. Nothing on this page is legal advice.

## What this project ships and does not ship

VirtualTour ships:

- Its code, under the MIT license. The engine is derived from driver.js.
- The [Thumbtack](./thumbtack) character, original art released under CC0.
- A loader, `loadClassicAvatarPack`, that reads two classic animation-map shapes.

It does not ship any Microsoft character art or animation data, and no page of this site links to a file that holds either. The loader has no bundled pack, no default address and no fallback address. Every address it fetches is one you pass in.

## Before you start

You need your own basis for using the art: a license, a legal assessment such as fair use in your jurisdiction, or a policy decision by your organization. This project cannot grant one and makes no promise that a given use is lawful. Check with your legal team.

## What files you need

Two files: a sprite sheet image and an animation map. This page does not say where to get them. Open-source desktop apps and web players that reproduce the character carry such files under code-only MIT licenses, and their license files say the art remains Microsoft's. [The license file of one such project](https://github.com/felixrieseberg/clippy/blob/main/LICENSE.md) shows what that notice looks like. Read it.

The loader takes the map in either of two shapes and tells them apart by what is in the file:

| Shape | How to recognize it | Frame size |
|---|---|---|
| Column and row list | A JSON array of `{ "Name", "Frames" }` objects. Each frame has `Duration` and `ImagesOffsets` (`Column`, `Row`), or `null` offsets. | Give `frameSize`, or leave it out and the loader divides the sheet size by the highest column and row used. |
| Pixel position map | A JSON object with `animations` and either `frameWidth` and `frameHeight`, or `framesize: [width, height]`. Each frame has `duration` and `position: [x, y]`, or an `images` list whose first entry is used. | The map carries its own. `frameSize` overrides it. |

Here are tiny made-up maps in each shape. They only show the structure.

<<< @/snippets/avatar/classic-column-row.json

<<< @/snippets/avatar/classic-position.json

Anything else throws `AvatarPackError` with the reason, such as `is not a recognized classic map`, or `an array map needs items shaped { Name, Frames }` for an array of the wrong shape.

## Host them yourself

Put both files on hosting you control. Do not add them to a public npm package, and do not import them through this library's package.

## Load the pack

The call takes only addresses you supply. These are placeholders:

<<< @/snippets/avatar/classic-pack.ts

| `loadClassicAvatarPack` option | Meaning |
|---|---|
| `sheetUrl`, `mapUrl` | Addresses of the sheet and the map. Required. |
| `frameSize` | `{ w, h }` in CSS pixels. See the table above. |
| `name` | The pack's display name. Defaults to "Classic avatar pack". |
| `roles` | Replaces individual default role mappings, such as `{ greet: "Show" }`. Each value must name an animation that exists in the map, or the load fails. A role you do not name keeps its default. |
| `fetch`, `signal` | Your own `fetch`, and an `AbortSignal`. |

The function returns a promise, so you can hand it straight to `withAvatar` as above. It throws `AvatarPackError` when a file cannot be fetched, the map is not a classic shape or the sheet does not load. The loader keeps the converted pack in memory. It does not write files or use storage.

## Role mapping

The loader picks roles from well-known animation names. A name the map does not have is skipped, and a role with no match is left out, so it plays `rest`. Override any of them with `roles`.

| Role | Animation names, first match wins |
|---|---|
| `rest` | `RestPose`, `Default`, otherwise the first animation |
| `idle` | Every animation whose name starts with `Idle` |
| `greet` | `Wave`, `Greeting`, `Show` |
| `point.left` | `GestureLeft` |
| `point.right` | `GestureRight` |
| `point.up` | `GestureUp` |
| `point.down` | `GestureDown` |
| `point.any` | `Explain`, `GetAttention` |
| `think` | `Thinking`, `Processing` |
| `celebrate` | `Congratulate` |
| `exit` | `GoodBye`, `Hide` |
| `alert` | `Alert`, `GetAttention` |

## Behavior notes

- **Ignored fields.** Sound and branching fields (`Sound`, `Branching`, `ExitBranch`, `sound`, `branching`, `exitBranch`, `useExitBranching`) are dropped. Only durations and frame positions are read, and a duration under 1 millisecond counts as 1.
- **Frames without a position are dropped.** An animation left with no frame throws.
- **Looping.** The column and row shape has no loop flag, so every animation plays once. The pixel position shape keeps `loop` when it is a boolean.
- **Reduced motion** shows a still frame: the first frame of a looping animation and the last frame of any other. Classic maps cannot name one.
- **License.** The converted pack's `license` is `{ name: "unknown", attribution: "Supplied by the integrator" }`, so code that reads `pack.license` can tell. When you bundle the library from source, the loader also logs a console warning once. The published avatar entry is a production build and prints nothing, so do not count on the log.

## Trademark

Do not name your product or feature after the character, and do not use the character's name in marketing. This page uses the name only to identify Microsoft's property.

## Checklist

- [ ] I have a rights basis for the art I load.
- [ ] I host the files myself.
- [ ] The files are not in a public package.
- [ ] Legal review is done, if my organization requires it.
- [ ] Attribution is handled the way my rights basis requires.

## Prefer the shipped character?

[Thumbtack](./thumbtack) is original to this project, CC0, and loads with `thumbtackPack()`. See [Licensing](../licensing) for what is covered.
