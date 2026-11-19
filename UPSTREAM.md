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
| 1.14.0 | 2026-11-13 | 2026-11-18 | Changed: cutout and popover cover only the part of the element in view | not needed for the cutout: the fork already clips it by scroll parents (WU-15); popover placement against the visible rect was re-checked in WU-46 (see the 2026-11-19 row) | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Changed: popover scrolls into view only as far as needed | not needed: scrolling is owned by WU-23 and differs by design | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Changed: keyboard goes back only if it is still on the popover when the tour ends | superseded: cherry-picked in WU-46 (see the 2026-11-19 row) | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Fixed: highlight follows a panel that scrolls inside the page | not needed: the fork listens to scroll in the capture phase (WU-16) | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Fixed: `onDestroyed` runs when the tour closes before the first step settles | cherry-picked in WU-26 by hand (the fork was affected; upstream code was restructured, so no patch applied). `onDestroyed` now also fires from the pending step; the ten lifecycle-matrix snapshot lines and the one hook-order line match upstream's | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-18 | Fixed: `waitForElement` longer than about 24 days no longer runs out at once | cherry-picked in WU-26 by hand (the fork was affected): waits and removal grace periods clamp to the largest timer delay (about 24.8 days, effectively endless) | WU-26 unit lead (first review) |
| Unreleased (commit `ebdcfda`) | 2026-11-14 | 2026-11-18 | Fixed: Tab no longer gets stuck on hidden or inert controls in the highlighted element | cherry-picked in WU-26 with `tools/upstream-apply.mjs`; applied cleanly. Trailer `Upstream: ebdcfda08ac99097bf6a4bf7391d65f136e47367 (unreleased)` | WU-26 unit lead (first review) |
| 1.14.0 | 2026-11-13 | 2026-11-19 | Changed: cutout and popover cover only the part of the element in view (re-check) | not needed, verified: the cut-out is clipped by scroll parents (WU-15, `test/engine/overlay-clip.test.ts`). The popover already stays inside the scroll panel through the `scroller` boundary even for an anchor wider than the panel (`test/engine/visible-anchor.test.ts`); only the arrow aim differs. Known gap, not adopted: upstream's `visibleRect` also follows shadow DOM hosts and `contain: paint`, which the fork's clip does not | WU-46 unit lead (re-check) |
| 1.14.0 | 2026-11-13 | 2026-11-19 | Changed: keyboard goes back only if it is still on the popover when the tour ends (re-check) | cherry-picked in WU-46 by hand (upstream's `engine.ts` was restructured, so no patch applied): `driver.ts` `destroy()` returns focus to the pre-tour element only when focus is on the body or inside the popover. Pinned by `test/a11y.test.ts` ("leaves focus where the user put it") | WU-46 unit lead (re-check) |
| Head `7c442ae` | 2026-11-14 | 2026-11-19 | Check for new upstream releases and commits | no change: upstream head is still `7c442ae` (changelog update after `ebdcfda`); nothing newer than 1.14.0 is tagged | WU-46 unit lead (re-check) |
The 2026-11-18 rows are the first review. The 2026-11-19 rows are the WU-46 re-check: every verdict above was checked again against the fork as it stands after M2, and the two verdicts marked for a re-check were resolved (below).

## Per-file table

Which fork work units changed each engine file (unit IDs from `docs/plan/15-work-units.md`; task IDs from `docs/plan/01-architecture.md` section 3), built from `git log` per file through WU-46. A reviewer reads this to know where an upstream hunk will conflict. "Kept" means the logic is upstream's with at most a class-name rename.

| File under `packages/core/src/engine/` | Fate | Work units |
|---|---|---|
| `driver.ts` | Changed: `createEngine()`, data attributes on `<body>`, `overlay: false`, escape and arrow switches, presenter hooks, `onStepCompleted`, `onDestroyed` before the first step settles, focus returns only while the tour holds it | WU-01, 05, 08, 19, 26, 27, 35, 46 |
| `types.ts` | Changed: new `Config`, `DriveStep` and `Popover` keys | WU-01, 05, 08, 14, 14b, 15, 16, 17, 18, 22, 23, 27, 28, 29, 33, 35 |
| `core/context.ts` | Changed: defaults and state for the new keys | WU-01, 05, 08, 15, 16, 22, 27, 28 |
| `core/options.ts` | Kept | WU-01 |
| `core/utils.ts` | Changed: `clipRectByScrollParents` (one style read per ancestor since WU-46), `layerFor` and mount resolution, `bringInView` options, `timerDelay`, containing-block detection | WU-01, 05, 15, 18, 23, 26, 46 |
| `core/click.ts` | Kept (class name only) | WU-01, 05 |
| `core/env.ts` | New: `isBrowser`, `prefersReducedMotion`, `isRtl` | WU-19, 33 |
| `core/namespace.ts` | New: class and attribute names from the `namespace` option | WU-05, 29, 33, 35 |
| `popover/popover.ts` | Changed: class names, `label` to `aria-label`, sanitized content, speaker layout, presenter mount, `arrow: false`, position strategy | WU-01, 05, 08, 14, 14b, 18, 23, 28, 35 |
| `popover/position.ts` | Changed the most: boundary and padding, `side: auto`, flip and shift, cross offset and RTL, absolute strategy, `RepositionInfo` for `onReposition` | WU-01, 05, 08, 22, 28, 29, 33, 35 |
| `popover/live-region.ts` | Kept (class name only) | WU-01, 05 |
| `overlay/overlay.ts` | Changed: scroll-parent clip, extra cutouts (path reused while rects are unchanged since WU-46), `mountIn`, reduced motion | WU-01, 05, 08, 15, 18, 21, 46 |
| `overlay/stage.ts` | Changed: four radii, extra-rect dedupe | WU-01, 17, 21 |
| `tour/highlight.ts` | Changed: data attributes, reduced motion, `lockScrollParent`, `bringInView` options, presenter calls, focus handling | WU-01, 05, 08, 16, 18, 19, 23, 36 |
| `tour/step.ts` | Changed: per-step position options, `label`, `over` for targets, sanitized content, presenter calls | WU-01, 05, 08, 14, 14b, 18, 22, 23, 27, 28, 29, 33, 35 |
| `tour/lifecycle.ts` | Changed: focus return target, action steps, accessibility audit fixes | WU-01, 27, 36 |
| `tour/wait.ts` | Changed: wait budget and timer clamp | WU-01, 26, 27 |
| `tour/removal.ts` | Changed: timer clamp | WU-01, 26 |
| `tour/allowed.ts` | Changed: extra cut-outs redraw | WU-01, 05, 21 |
| `tour/completion.ts` | Changed: calls `onStepCompleted` | WU-01, 27 |
| `tour/nudge.ts` | Changed: public nudge hook | WU-01, 05, 27 |
| `tour/advance.ts` | Kept | WU-01 |
| `interaction/events.ts` | Changed: split key switches, capture-phase scroll listener, `onReposition` call, hidden-control focus filtering | WU-01, 05, 08, 15, 16, 26 |
| `interaction/region.ts` | Kept (class name only) | WU-01, 05 |
| `interaction/gate.ts`, `gesture.ts`, `keys.ts`, `trust.ts` | Kept | WU-01 |
| `styles/engine.css` (was `styles/driver.css`) | Changed: rules keyed on data attributes, fade under `prefers-reduced-motion: no-preference`, strategy rules | WU-05, 19, 29 |
| `styles/popover.css` | Moved to `packages/core/src/styles/base.css` with renamed classes | WU-05, 22 |
| `hints.ts`, `checklist.ts`, `styles/hints.css`, `styles/checklist.css` | Removed | WU-01 |
| `css.d.ts` | Kept | WU-01 |

Upstream cherry-picks recorded in the log above touched `core/utils.ts` (`timerDelay`, hidden-control filtering), `tour/wait.ts`, `tour/removal.ts`, `driver.ts` and `interaction/events.ts` (WU-26), and `driver.ts` (WU-46).
