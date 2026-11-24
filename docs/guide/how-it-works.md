# How it works

VirtualTour is a fork of [driver.js](https://github.com/nilbuild/driver.js). The tour engine is driver.js code that lives in this repository and is changed in place. A public layer on top of it gives you `createTour`, typed events, rich step content and the extras. This page says what came from driver.js, what we changed, and how we keep up with upstream.

## The layers

```
your code
   │  createTour(config)
   ▼
public layer     Tour, TourStep, events, registry, eligibility loop,
   │             JSON tours, persistence, presenters
   │  compile: tour config ──▶ engine config
   ▼
engine           step navigation, popover, positioning, overlay,
                 focus and keys, waiting for elements, action steps
                 (forked from driver.js, never exported)
```

The public layer turns your `TourConfig` and `StepConfig` objects into engine options and drives the engine one step at a time. The engine is not exported from any entry point, so there is nothing of driver.js to import. The package has no runtime dependencies.

## What came from driver.js

These parts are driver.js code, kept as they are or with small changes:

- Step navigation, including waiting for an element that renders late and skipping one that never does.
- The popover: HTML title and description, Next, Back and Close buttons, progress text, arrow, and updating content in place.
- Side-based positioning with a fallback when the popover does not fit.
- The SVG overlay with a cut-out around the target and its animation.
- Focus trap and focus restore, Escape and arrow keys that skip editable fields, and the live region that announces steps.
- Action steps: an instruction the user must carry out, `advanceDelay`, nudging.
- Layering inside an open `<dialog>`, and following elements that a framework re-renders.
- The test suites that cover all of the above, ported to run against our copy.

## What we changed in the engine

- Class names changed from `driver-` to `vt-`, and the state classes on page elements take a configurable `namespace`. See [Styling](./styling) and [From driver.js](../migration/from-driverjs).
- Escape and the arrow keys are separate switches (`keys.escape`, `keys.arrows`).
- Positioning gained `side: 'auto'`, `side: 'over'`, a boundary that follows scroll parents, `flip` and `shift` switches, a cross-axis offset, right-to-left mirroring, arrow `minInset`, and `strategy: 'absolute'`. See [Positioning](./positioning).
- The overlay gained a cut-out clipped by scroll parents, extra cut-outs, per-corner radius, per-step padding and radius, and reduced-motion handling in JavaScript. See [Overlay](./overlay).
- Freezing the target's scroll parent is opt-in (`dim.lockScrollParent`). driver.js always froze it.
- `mountIn` and `dimMountIn` choose where the popover and overlay are inserted. See [Containers](./containers).
- Untitled steps get an accessible name from `label`, and the popover can be built in a speaker layout for the avatar. See [Accessibility](./accessibility) and [Presenters](./presenters).

## What we added around the engine

- `Tour` and `TourStep` classes, promises that resolve when a step is shown, and adding or dropping steps while a tour runs.
- A typed event emitter on tours and steps, and a global registry (`tours`) that relays every tour event. See [Events and lifecycle](./events-and-lifecycle).
- The eligibility loop: `shouldShow`, `waitFor`, `whenMissing` and `prepare`. See [Steps and targets](./steps-and-targets).
- A versioned JSON tour format. See [JSON tours](./json-tours).
- Progress persistence with local-storage and in-memory stores. See [Persistence](./persistence).
- A theme stylesheet with dark mode, and the `virtual-site-tour/motion` add-on. See [Motion](./motion).
- React and Vue wrappers. See [Framework wrappers](./framework-wrappers).
- The optional avatar with a speech bubble, in `virtual-site-tour/avatar`. See [Avatar](../avatar/).

driver.js hints and checklists are not part of VirtualTour. Those files were removed from the fork.

## Fork point and license

| | |
|---|---|
| Upstream repository | `https://github.com/nilbuild/driver.js` |
| Fork point | tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63` |
| License | MIT |
| Copyright lines | `Copyright (c) Kamran Ahmed` and `Copyright (c) 2026 VirtualTour contributors` |

The upstream copyright and permission notice are kept in `LICENSE`, and `NOTICE.md` reproduces the original notice verbatim. `packages/core/src/engine/` derives from `packages/driver/src/` at the fork point. Both files are in the [repository](https://github.com/quaz579/virtualtour).

## Tracking upstream

VirtualTour's engine is a fork of driver.js at tag `1.12.1`. The fork never waits for upstream, but fixes to code we still share are worth having.

- A maintainer reads the upstream changelog on every release and at least once a quarter, and records a verdict for every entry in [`UPSTREAM.md`](https://github.com/quaz579/virtualtour/blob/main/UPSTREAM.md).
- `node tools/upstream-apply.mjs <sha>` takes one upstream commit, rewrites its paths and class names to ours, and stages it with a three-way apply. It never commits and leaves conflicts for you.
- It refuses commits that touch hints, checklists or the popover stylesheet, because those files were removed or moved.
- Commits made this way carry an `Upstream: <sha> (<version>)` trailer.

See `UPSTREAM.md` for the policy, the review log and the table of which fork tasks changed each engine file.
