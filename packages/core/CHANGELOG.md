# Changelog

## 1.0.0 (not yet released)

First release. The tour engine is derived from driver.js 1.12.1 (tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`, MIT). See `NOTICE.md` for the license and the files not carried over, and `UPSTREAM.md` in the repository for how later upstream changes are tracked.

### Public API

- `createTour`, `Tour`, `TourStep`: declarative tours with typed events, navigation, eligibility (conditional steps, waits, skip, prepare, reveal, auto-advance), action steps, persistence and resume.
- `parseTourJson` and `serializeTour`, with `schemas/tour.v1.schema.json`.
- `virtualtour/avatar`: `withAvatar`, `SpeakerPresenter`, pack loaders and validation, Thumbtack (CC0). `virtualtour/motion`: `glide`, `progressVars`.
- Stylesheets: `base.css` (required), `theme.css` (optional, light and dark), `avatar.css`. See `STYLES.md` for every class and variable.
- The exact exported surface is frozen in `API-FREEZE.md`.

### Engine changes from driver.js, by fork task

- F-03: classes renamed from `driver-` to `vt-`, state exposed as data attributes, and a `namespace` option.
- F-04: the cut-out is clipped by the scroll containers that crop the target.
- F-05: extra cut-outs for allowed elements anywhere on the page, deduplicated.
- F-06: popover boundary, viewport padding, and `side: "over"` for targets.
- F-07: flip, alignment flip and shift switches, and `side: "auto"`.
- F-08: cross-axis offset, RTL mirroring, arrow off and minimum arrow inset. A popover whose direction differs from its target's takes the target's direction while the step has a real target.
- F-09: the highlight follows nested scroll containers, with an optional scroll-parent lock.
- F-10: `absolute` position strategy for transformed containers.
- F-11: reveal options, native `scrollIntoView` options, and reduced-motion-safe scrolling.
- F-12: per-corner cut-out radius.
- F-13: `mountIn` and `dimMountIn` containers for the popover and overlay.
- F-14: `prefers-reduced-motion` honored in the engine.
- V-02, V-05, V-06 and A-04: engine seams for the public API, accessible names and sanitized content, action steps, and the speaker layout.
- Upstream cherry-picks: `onDestroyed` fires when a tour closes before its first step settles, very long waits no longer expire at once, Tab skips hidden or inert controls, and focus returns to the trigger only when the tour still holds it.
- Removed: hints and checklist.
- Refresh cost: fewer style reads per reposition, and the extra cut-out path is reused while the rectangles stay the same.
