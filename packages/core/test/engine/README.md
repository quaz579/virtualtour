# Engine tests

These files derive from the driver.js 1.12.1 unit suite (`packages/driver/tests/`, commit `0163642dc532417ea401684bd26690e2f3283d63`). The layout is unchanged (`core/`, `popover/`, `tour/`, `utils.ts`, `__snapshots__/`), so an upstream test change maps to the same path here. They run under the `unit-dom` project (`npm test -- test/engine`). Class strings still read `driver-*` until the rename work renames them.

Count: 19 test files (22 upstream minus `hints/hints.test.ts`, `checklist/checklist.test.ts` and `core/public-surface.test.ts`), plus `utils.ts` and two snapshot files. The `core/fixtures/` usage files only served the dropped public-surface test and were not copied.

Edits against upstream, none of which weaken an assertion:

- Imports point at `src/engine/driver`; `driver(` becomes `createEngine(`; the console prefix `[driver.js]` becomes `[virtualtour]` (`tour/action-steps.test.ts`); the popover stylesheet path becomes `src/engine/styles/popover.css` (`popover/custom-buttons.test.ts`).
- `core/ssr.test.ts` drops the hints and checklist import test, because those modules are not carried over.
- Type-only changes so the files pass the strict check config (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`): non-null assertions on indexed access, `undefined as never` where a test passes an explicit `undefined`, a three-element tuple type for `SAMPLE_STEPS`, `HTMLElement` as the type returned by `popoverEl`, and an explicit `return undefined`.
- `tour/lifecycle-matrix.test.ts` disables jsdom's focus fixup, which jsdom runs on a real 60 Hz timer outside the fake clock. Under CPU load it fired mid-test and moved focus to `body`, so snapshots flaked. With it off, the run is deterministic and the recorded snapshots still match. The stub reaches into a private jsdom hook (`jsdom.window._requestFocusFixup`); if jsdom renames it the stub silently stops working and the focus flake returns. Real-browser focus behavior is covered by the Playwright specs.
- Upstream ran vitest 4 and jsdom 29; this repo uses vitest 3 and jsdom 31. No test needed a version-specific change.
