# Tracking upstream driver.js

Fork point: tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63` of https://github.com/nilbuild/driver.js (see `NOTICE.md`).

## Policy

- Nothing in this project waits for upstream. Every feature lands in `packages/core/src/engine/` directly.
- Review cadence: on every upstream release, and at least once a quarter, a maintainer reads the upstream changelog (`apps/docs/src/content/guides/changelog.mdx`) and records the review in the log below with a verdict per entry.
- Cherry-pick security fixes and bug fixes in code the fork still shares (anything under `src/engine/` whose logic was not rewritten). New upstream features are not adopted by default.
- Ignore changes to hints, checklists, the Astro playground, the docs site, and the `tsdown` build.
- Verdicts are `cherry-picked <where>`, `not needed` (we already have it, or it is a feature we did not adopt) or `not applicable` (code we do not carry).
- A fix that applies upstream may be offered back as a pull request. It never blocks anything here.

## Mechanics

- Add the upstream repository as a git remote named `upstream`: `git remote add upstream https://github.com/nilbuild/driver.js.git`. The tool fetches upstream tags into `refs/tags/upstream/*` itself.
- Apply one upstream commit with `node tools/upstream-apply.mjs <sha>` (add `--dry-run` to print the rewritten patch). It runs `git format-patch -1 <sha>`, rewrites `packages/driver/src/` to `packages/core/src/engine/` and `styles/driver.css` to `styles/engine.css`, renames `driver-` class strings through the table in the tool (checked against `core/namespace.ts` by `test/upstream-apply.node.test.ts`) and `[driver.js]` to `[virtualtour]`, drops files outside `packages/driver/src/`, then runs `git apply --3way --index`.
- The tool refuses (exit code 2) a patch that touches `hints.ts`, `checklist.ts`, `styles/hints.css`, `styles/checklist.css` (removed from the fork) or `styles/popover.css` (moved to `src/styles/base.css`; port that hunk by hand).
- The tool never commits. Conflicts stay in the tree for the maintainer. It prints the trailer to add: `Upstream: <sha> (<version>)`.
- Every cherry-pick commit message carries that trailer.
- After a cherry-pick, run the ported engine suite first (`test/engine/**`, `e2e/engine/**`), then the whole suite. An engine edit changes the fork-point fingerprint: regenerate it with `UPDATE_FORK_POINT=1 npm test -- test/fork-point.node.test.ts`.
- Upstream restructured its engine in 1.13.0 (`core/engine.ts`, `core/renderer.ts`, `renderer/*`, `tour/transfer.ts`, a headless entry). Patches written after that point often will not apply to our file layout; port the change by hand and say so in the verdict.

## Review log

Columns: upstream version, release date, review date, changelog entries, verdict per entry, reviewer. Upstream shipped 1.13.0 and 1.14.0 on 2026-11-13, so the fork point (1.12.1, 2026-11-12) is already behind. Release dates come from the upstream tags.

| Upstream version | Released | Reviewed on | Entries | Verdict per entry | Reviewer |
|---|---|---|---|---|---|
| 1.13.0 | 2026-11-13 | 2026-11-18 | Added: headless build (`driver.js/headless`) | not applicable: we expose a presenter seam instead and carry no headless entry | WU-26 unit lead (first review) |
| 1.13.0 | 2026-11-13 | 2026-11-18 | Added: `scrollIntoView: false` | not needed: the `scrollIntoView` step and config option already shipped (WU-23) | WU-26 unit lead (first review) |
| 1.13.0 | 2026-11-13 | 2026-11-18 | Added: `onWaitingForElement` | not needed: new feature, not adopted by default | WU-26 unit lead (first review) |
| 1.13.0 | 2026-11-13 | 2026-11-18 | Added: `onElementReplaced` | not needed: new feature, not adopted by default | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Added: `waitForRemovedElement`, `Infinity` waits | not needed: new feature; the fork has `waitBudget` and `hookTimeout` instead | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Added: `scrollIntoView` takes `{ block, inline }` | not needed: the fork already accepts `ScrollIntoViewOptions` (WU-23) | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Added: `allowPageInteraction` | not needed: new feature, not adopted by default | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Added: `focus` option | not needed: new feature, not adopted by default | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Added: headless `onInteraction` region `allowed` | not applicable: no headless entry | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Added: `onPopoverPositioned` | not needed: the fork has `onReposition` and the presenter `afterReposition` hook | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Changed: cutout and popover cover only the part of the element in view | not needed for the cutout: the fork already clips it by scroll parents (WU-15); popover placement against the visible rect is not verified, re-check in WU-46 | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Changed: popover scrolls into view only as far as needed | not needed: scrolling is owned by WU-23 and differs by design | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Changed: keyboard goes back only if it is still on the popover when the tour ends | not needed: behavior change, not a bug fix; re-check in WU-46 | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Fixed: highlight follows a panel that scrolls inside the page | not needed: the fork listens to scroll in the capture phase (WU-16) | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Fixed: `onDestroyed` runs when the tour closes before the first step settles | cherry-picked in WU-26 by hand (the fork was affected; upstream code was restructured, so no patch applied). `onDestroyed` now also fires from the pending step; the ten lifecycle-matrix snapshot lines and the one hook-order line match upstream's | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Fixed: `waitForElement` longer than about 24 days no longer runs out at once | cherry-picked in WU-26 by hand (the fork was affected): waits and removal grace periods clamp to the largest timer delay (about 24.8 days, effectively endless) | WU-26 unit lead (first review) |
| Unreleased (commit `ebdcfda`) | 2026-11-14 | 2026-11-18 | Fixed: Tab no longer gets stuck on hidden or inert controls in the highlighted element | cherry-picked in WU-26 with `tools/upstream-apply.mjs`; applied cleanly. Trailer `Upstream: ebdcfda08ac99097bf6a4bf7391d65f136e47367 (unreleased)` | WU-26 unit lead (first review) |

The per-entry verdicts for 1.13.0 and 1.14.0 are redone in WU-46 so the per-file table below covers every M2 change.

## Per-file table

Which fork tasks changed each engine file (task IDs from the plan, `docs/plan/01-architecture.md` section 3). A reviewer reads this to know where an upstream hunk will conflict.

| File under `packages/core/src/engine/` | Fate | Fork tasks |
|---|---|---|
| `driver.ts` | Changed: `createEngine()`, data attributes on `<body>`, `overlay: false`, escape and arrow switches, presenter hooks, `onStepCompleted`, `setSteps` mid-tour returns focus to the start element | F-03, V-02, V-06, WU-36 |
| `types.ts` | Changed: new `Config`, `DriveStep` and `Popover` keys | V-02, F-04..F-14 |
| `core/context.ts` | Changed: defaults for the new keys | V-02, F-04..F-14 |
| `core/options.ts` | Kept | |
| `core/utils.ts` | Changed: `clipRectByScrollParents`, `layerFor` and mount resolution, `bringInView` options, reduced motion, RTL, focus filtering | F-04, F-08, F-11, F-13, F-14 |
| `core/click.ts` | Kept | |
| `core/env.ts` | New: `isBrowser`, `prefersReducedMotion`, `isRtl` | F-14 |
| `core/namespace.ts` | New: class and attribute names from the `namespace` option | F-03 |
| `popover/popover.ts` | Changed: class names, `label` to `aria-label`, speaker layout, presenter mount, `arrow: false` | F-03, V-02, V-05, F-08, A-04 |
| `popover/position.ts` | Changed the most: boundary and padding, `side: auto`, flip and shift, cross offset and RTL, absolute strategy, `{ side, align }` for `onReposition` | V-02, F-06, F-07, F-08, F-10, A-04 |
| `popover/live-region.ts` | Kept (class name only) | F-03 |
| `overlay/overlay.ts` | Changed: scroll-parent clip, extra cutouts, `mountIn`, reduced motion, strategy | F-04, F-05, F-10, F-13, F-14 |
| `overlay/stage.ts` | Changed: four radii, extra-rect dedupe | F-05, F-12 |
| `tour/highlight.ts` | Changed: data attributes, reduced motion, `lockScrollParent`, `bringInView` options, presenter calls, `aria-haspopup`, `aria-expanded` and `aria-controls` on popup-capable targets (restored when the step ends; attributes the page set are left alone) | F-03, V-02, F-09, F-11, F-14, WU-36 |
| `tour/step.ts` | Changed: per-step position options, `label`, `over` for targets | V-02, V-05, F-06, F-07, F-08, F-10 |
| `tour/lifecycle.ts` | Changed: `enterStep` keeps the first element that had focus as the return target for the whole run, including after `setSteps` mid-tour | F-03, WU-36 |
| `tour/completion.ts`, `tour/removal.ts`, `tour/wait.ts`, `tour/advance.ts`, `tour/allowed.ts`, `tour/nudge.ts` | Kept apart from class names; `completion.ts` calls `onStepCompleted` | F-03, V-06 |
| `interaction/events.ts` | Changed: split key switches, capture-phase scroll listener, `onReposition` call | V-02, F-09 |
| `interaction/gate.ts`, `gesture.ts`, `keys.ts`, `region.ts`, `trust.ts` | Kept | |
| `styles/driver.css` as `styles/engine.css` | Changed: rules keyed on data attributes, fade under `prefers-reduced-motion: no-preference` | F-03, F-14 |
| `styles/popover.css` | Moved to `packages/core/src/styles/base.css` with renamed classes | F-03, F-10, V-08 |
| `hints.ts`, `checklist.ts`, `styles/hints.css`, `styles/checklist.css` | Removed in F-01 | |
| `css.d.ts` | Kept | |

WU-26 also touched `core/utils.ts` (`timerDelay`), `tour/wait.ts`, `tour/removal.ts`, `driver.ts` and `interaction/events.ts` through the cherry-picks above.
