# Licensing

VirtualTour has two parts with two licenses: the code, and the one character it ships. This page says which is which in plain language. It is not legal advice.

## The code: MIT

The code is under the MIT license. The license file carries two copyright lines:

- Copyright (c) Kamran Ahmed
- Copyright (c) 2026 VirtualTour contributors

The first is the author of driver.js, the library the tour engine is forked from. The second covers this project's own work. The MIT license lets you use, copy, modify and distribute the code, including in commercial products, as long as you keep the license text and these notices.

## Where the engine comes from

The engine in `packages/core/src/engine/` derives from [driver.js](https://github.com/nilbuild/driver.js), which is also MIT. The fork point is tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`. `NOTICE.md` in the repository records the fork point and reproduces the upstream notice, and `UPSTREAM.md` lists later upstream changes that were taken over.

## The Thumbtack character: CC0

The [Thumbtack](./avatar/thumbtack) character and its push-pin and round-top variants are original to this project and are dedicated to the public domain under CC0 1.0. That covers both variants' SVG sources, `frames.mjs`, `sheet.png` and `pack.json`. No rights are reserved and no credit is required. Use it, change it or ship it in your own product without asking.

The text is in `packages/core/src/avatar/thumbtack/LICENSE-ART.md` in the repository, and the published package carries it too. `packages/core/ART.md` records where the character came from. The code that generates it, `packages/core/tools/build-thumbtack-pack.mjs`, stays under MIT like the rest of the code.

## Other character art: not included

The project ships no third-party character art, and its repository does not accept any. Tests check the repository and the published package for oversized sheets, large animation maps and file names that point at known third-party characters.

If you load character art made by someone else, the right to use it is yours to establish. The loader for classic packs takes only addresses you supply, and the pack it builds reports its license as `unknown`. See [Loading a classic paperclip avatar pack](./avatar/classic-packs) for what that means in practice.

## Your own packs

A pack you draw yourself is yours to license. Put it in the pack's `license` field so people who load it can see it. See [Make your own pack](./avatar/make-a-pack).

## Summary

| Part | License | Credit needed |
|---|---|---|
| Code (core, wrappers, tools) | MIT | Keep the license text and both notices |
| Engine ancestry | driver.js, MIT | Keep the upstream notice |
| Thumbtack character | CC0 1.0 | No |
| Third-party character art | Not shipped | Not applicable |
