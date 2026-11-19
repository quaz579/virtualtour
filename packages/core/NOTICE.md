# Notice

VirtualTour's tour engine is a fork of driver.js.

| | |
|---|---|
| Upstream repository | https://github.com/nilbuild/driver.js |
| Fork point tag | `1.12.1` |
| Fork point commit | `0163642dc532417ea401684bd26690e2f3283d63` |
| Upstream release date | 2026-11-12 |
| License | MIT |

`packages/core/src/engine/` derives from `packages/driver/src/` at that commit.

## Files not carried over

- `hints.ts` and `styles/hints.css`
- `checklist.ts` and `styles/checklist.css`
- The Astro apps (playground and docs site)
- The upstream build configuration (`tsdown`, `turbo`, `pnpm` workspace files)

Later upstream changes that are cherry-picked are recorded in `UPSTREAM.md`, each citing its upstream commit.

## Original notice

The following notice is reproduced verbatim from upstream.

```
The MIT License

Copyright (c) Kamran Ahmed

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
