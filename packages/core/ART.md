# Artwork

Thumbtack, the avatar that ships with VirtualTour, is original to this project and has two visual variants: the push-pin default and the original round-top design. Each variant has its own `frames.mjs`, SVG sources, `sheet.png` and `pack.json` under `src/avatar/thumbtack/` and `src/avatar/thumbtack/round/`. `tools/build-thumbtack-pack.mjs` writes the frames and rasterizes each variant. The author is the VirtualTour contributors. No frame was traced from, measured against, or derived from another character, and no third-party character art, screenshot of such art, or animation data describing it is accepted into this repository.

Both Thumbtack variants are dedicated to the public domain under CC0 1.0; see `dist/thumbtack/LICENSE-ART.md` in the package (the repository keeps the source at `src/avatar/thumbtack/LICENSE-ART.md`, and the build copies it). The code in `tools/build-thumbtack-pack.mjs` stays under the project's MIT license.
