# Release checklist for 1.0

Nothing here tags, publishes or hosts anything. A box is checked only when the check was run and recorded; the date and the evidence sit on the line. Unchecked boxes are open release gates.

## Legal

- [x] `LICENSE` carries both copyright lines (`Kamran Ahmed` and `VirtualTour contributors`) in the root and in all three packages. Checked by `test/release.node.test.ts`.
- [x] `NOTICE.md` names the fork point tag `1.12.1` and commit `0163642dc532417ea401684bd26690e2f3283d63` and lists every file not carried over. Both copies agree.
- [ ] Legal review of `LICENSE`, `NOTICE.md`, `ART.md`, `LICENSE-ART.md` (CC0) and `docs/avatar/classic-packs.md`. Open gate: needs a lawyer, not code.
- [x] The art tripwire passes on the source tree and on the packed tarball (`test/avatar/art-tripwire.node.test.ts`, `test/build.node.test.ts`).

## Upstream

- [x] `UPSTREAM.md` has a review row dated within 90 days of the release. Last review: 2026-11-19, upstream head `7c442ae`. Re-review if the release is more than 90 days later.

## Quality gates

- [ ] The full end-to-end matrix is green on four engines (chromium, firefox, webkit, edge) for the ported engine suites and the public suites. Chromium, firefox and webkit ran in WU-46; edge was not installed on the run machine, so that engine is unproven.
- [x] The SSR gate is green (`test/ssr.node.test.ts`, `test/tour-ssr.node.test.ts`).
- [x] The size report was run and recorded in `SIZE.md` (`npm run size -- --write`).
- [x] The perf tripwire passes (`e2e/perf.spec.ts`, chromium): no long task and above 50 fps during 2 s of wheel scrolling on a 10 000-row list.
- [x] The accessibility audit is green in dialog and avatar modes. Dialog mode is covered by `e2e/a11y.spec.ts`; the avatar axe cases in the same file (`avatar presenter`: five speaker layouts, a classic-a and a v1 avatar tour) passed on chromium, firefox and webkit on 2026-11-20 (21 of 21, run serially at `--workers=1`).
- [ ] A manual screen-reader run (VoiceOver and NVDA) is recorded. Open gate: needs a person.
- [x] The docs link check is green (`npm run docs:links`, run 2026-11-19).

## Repository hygiene

- [x] No company or product names other than driver.js appear in the repository: `npm run lint:prose` with a maintainer-supplied word list (`REQUIRE_BANNED_WORDS=1`).
- [x] `grep -r "driver-" packages/core/src` is empty. Checked by `test/release.node.test.ts`.
- [x] Version numbers are consistent across the three packages (all `0.0.0` until the release commit sets `1.0.0`). Checked by `test/release.node.test.ts`.
- [x] `API-FREEZE.md` matches the exports of `virtualtour`, `virtualtour/avatar` and `virtualtour/motion` (`test/api-freeze.node.test.ts`).
- [x] `npm pack --dry-run` lists exactly the intended files for each package (`test/build.node.test.ts`).
- [x] `packages/core/CHANGELOG.md` has a 1.0.0 entry with the "derived from driver.js 1.12.1" line.

## At release time

- [ ] Set the version to `1.0.0` in all three packages, remove `"private": true`, choose the npm name and import path, and update the peer ranges of the wrappers.
- [ ] Re-run the full matrix on the release commit.
- [ ] Tag, publish and host the docs (not done by any work unit).
