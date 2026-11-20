# Migrating from driver.js

VirtualTour's engine is a fork of driver.js 1.12.1, but its public API is its own. driver.js's `driver()`, `Config`, `DriveStep` and `driver-*` class names are not exported and not kept compatible. Moving over means renaming options and hooks and renaming classes in your CSS. This page lists every driver.js name at the fork point and what replaces it.

## At a glance

| driver.js | VirtualTour |
|---|---|
| `driver(config)` then `drive()` | `createTour(config)` then `start()`, which returns a promise |
| One config object, one callback per hook | A tour config, a step config per step, and typed events |
| `steps[].popover.*` nested options | Flat step fields: `title`, `body`, `placement` |
| Overlay always drawn | Overlay only with `dim: true` |

A tour that points at two buttons looks like this after the move:

<<< @/snippets/migration/translated-tour.ts

## Options

Left column: the name in driver.js 1.12.1. Right column: where it lives now. Names such as `dim.padding` are keys of the tour config. Names that start with `steps[]` are keys of a step, and you can set any of them for every step through `stepDefaults`.

| driver.js | VirtualTour | Notes |
|---|---|---|
| `steps` | `steps` | A list of step configs. Add or remove steps later with `tour.appendStep()` and `tour.dropStep()`. |
| `element` | `steps[].target` | A selector, an element, or a function returning either. A step with no target is centered. |
| `popover.title` | `steps[].title` | A string or a function. HTML passes through `sanitize` when you set one. |
| `popover.description` | `steps[].body` | A string, a list of paragraphs, an element, or a function. |
| `popover.side` | `steps[].placement` | `{ side, align }`. Also accepts `'auto'` and the side `'over'`. |
| `popover.align` | `steps[].placement` | The `align` key of the same object. |
| `popover.instruction` | `steps[].instruction` | Action steps. See [Action steps](../guide/action-steps). |
| `data` | `steps[].meta` | Any JSON value. The library never reads it. |
| `animate` | `animate` | Same meaning. Reduced motion turns animation off regardless. |
| `duration` | `dim.transitionMs` | Milliseconds. Default 400. |
| `overlayColor` | `dim.color` | Default `#000`. |
| `overlayOpacity` | `dim.opacity` | Default 0.7. |
| `smoothScroll` | `steps[].reveal` | Use `'smooth'`. `reveal` also takes `false` and `ScrollIntoViewOptions`, and `revealWith` replaces the scroll. |
| `allowClose` | `keys.escape` | There is no single switch. Combine `keys.escape: false`, `steps[].closeButton: false` and `dim.clickOutside: 'none'`. |
| `allowScroll` | `dim.pageScroll` | Default true, as in driver.js. |
| `overlayClickBehavior` | `dim.clickOutside` | `close` becomes `exit`, `nextStep` becomes `forward`. Default `none`. A function is not supported. |
| `stagePadding` | `dim.padding`, `steps[].spotlight.padding` | Default 10. |
| `stageRadius` | `dim.radius`, `steps[].spotlight.radius` | A number or per-corner radii. Default 5. |
| `disableActiveInteraction` | `steps[].spotlight.targetInteractive` | Inverted. `true` becomes `false`, and `'clicks'` becomes `'hover-only'`. |
| `advanceOn` | `steps[].autoAdvance` | `{ event, selector, strict }`. The `when` predicate has no equivalent. |
| `advanceOnClick` | `steps[].autoAdvance` | Deprecated upstream. Use `{ event: 'click' }`. |
| `allowedElements` | `steps[].spotlight.extra` | Selectors only. Extras are cut out of the overlay and stay interactive. |
| `skipMissingElement` | `steps[].whenMissing` | Use `'skip'`. The default is `'center'`: show the step centered. |
| `waitForElement` | `steps[].waitFor` | Milliseconds. `waitBudget` caps the total across consecutive waiting steps. |
| `advanceDelay` | `steps[].advanceDelay` | Same meaning. |
| `allowKeyboardControl` | `keys.escape`, `keys.arrows` | Two switches, both on by default. |
| `popoverClass` | `steps[].classes` | A string or a list. |
| `popoverOffset` | `steps[].position.offset` | A number, or `{ main, cross }`. Default 10. |
| `showButtons` | `steps[].buttons` | Set `buttons` to replace Next and Back. Hide Close with `closeButton: false`. |
| `disableButtons` | `steps[].buttons` | Each custom button takes `disabled`. |
| `showProgress` | `counter` | `true` shows "1 of 3". |
| `progressText` | `counter` | Pass a function. The `{{current}}` and `{{total}}` placeholders are not supported. |
| `nextBtnText` | `labels.next` | Tour-wide. Per step, use a custom button. |
| `prevBtnText` | `labels.back` | Tour-wide. |
| `doneBtnText` | `labels.done` | Tour-wide. |
| `closeBtnLabel` | `labels.close` | Per step, use `steps[].closeButton.label`. |
| `onPopoverRender` | `presenter` | A presenter's `mount` runs after the content is applied and before the popover is positioned. |
| `onElementMissing` | `steps[].whenMissing` | Only `skip` and `center`. The `stay`, `previous` and function forms have no equivalent. |
| `onInteraction` | none | No equivalent. Use `dim.clickOutside` and `steps[].spotlight.targetInteractive`. |

## Hooks and methods

driver.js has one callback per hook and one object with methods. VirtualTour has events and a `Tour` class.

| driver.js | VirtualTour | Notes |
|---|---|---|
| `onHighlightStarted` | `step.on("will-show")` | Also `tour.on("step-shown")` once the step is on screen. |
| `onHighlighted` | `step.on("shown")` | |
| `onDeselected` | `step.on("hidden")` | `will-hide` fires just before. |
| `onDestroyStarted` | `exitPrompt` | Ask before closing. The prompt can veto, and a plain event cannot. |
| `onDestroyed` | `tour.on("exited")` | `tour.on("finished")` for a completed tour. `reason` names how the tour ended. |
| `onNextClick` | `steps[].buttons` | A custom button with a function `action`. |
| `onPrevClick` | `steps[].buttons` | |
| `onCloseClick` | `tour.on("exited")` | `reason` is `close`. |
| `onDoneClick` | `tour.on("finished")` | |
| `isActive` | `tour.isRunning()` | |
| `refresh` | `tour.refresh()` | |
| `drive` | `tour.start()`, `tour.goTo()` | `goTo` takes an index, an id or a step. |
| `moveNext` | `tour.forward()` | Returns a promise. |
| `movePrevious` | `tour.backward()` | Returns a promise. |
| `moveTo` | `tour.goTo()` | |
| `destroy` | `tour.exit()`, `tour.finish()` | `exit()` asks the prompt first and resolves `false` if declined. |
| `advance` | `tour.advance()` | Completes the action step on screen. |
| `nudge` | `tour.nudge()` | |
| `updatePopover` | `step.configure()` | Merges a patch and re-renders in place. Pass `null` for a field to clear it back to the default. |
| `getActiveStep` | `tour.currentStep` | `null` when no step is on screen. |
| `getActiveElement` | `step.resolvedTarget` | Read it from `tour.currentStep`. |
| `getActiveIndex` | `tour.progressInfo()` | 1-based `index`, and 0 when no step is on screen. |
| `isFirstStep` | `tour.progressInfo()` | Compare `index` with 1. |
| `isLastStep` | `tour.progressInfo()` | Compare `index` with `total`. |
| `hasNextStep` | `tour.steps` | Steps whose `shouldShow` returns false are skipped at navigation time. |
| `hasPreviousStep` | `tour.steps` | |
| `getNextStep` | `tour.steps` | |
| `getPreviousStep` | `tour.on("step-shown")` | The event carries `previous`. |
| `getPreviousElement` | `tour.on("step-shown")` | Read it from `previous.resolvedTarget`. |
| `setSteps` | `tour.appendStep()`, `tour.dropStep()` | Or create a new tour. |
| `setConfig` | none | Tour options are read when the tour is created. Change a step with `step.configure()`. |
| `getConfig` | none | |
| `getState` | none | |
| `highlight` | none | There is no standalone highlight. Run a one-step tour. |

## Class names

Replace these in custom CSS. The classes on page elements take the tour's `namespace` (default `vt`), so `.vt-target` is `.<namespace>-target` for a tour that sets one. Popover classes never change. The default namespace is not a compatibility switch: the suffixes differ too, so `driver-` cannot be kept by setting `namespace: 'driver'`.

| driver.js | VirtualTour | Notes |
|---|---|---|
| `.driver-active` | `.vt-active` | On `<body>` while a tour runs. |
| `.driver-fade` | `.vt-fade` | |
| `.driver-simple` | `.vt-simple` | |
| `.driver-no-scroll` | `.vt-no-scroll` | |
| `.driver-overlay` | `.vt-overlay` | |
| `.driver-overlay-animated` | `.vt-overlay-animated` | |
| `.driver-active-element` | `.vt-target` | The highlighted element. |
| `.driver-active-element-raised` | `.vt-target-raised` | |
| `.driver-active-element-parent` | `.vt-target-parent` | |
| `.driver-active-element-parent-no-scroll` | `[data-vt-lock-scroll]` | An attribute on the target's parent, set only with `dim.lockScrollParent`. |
| `.driver-no-interaction` | `.vt-target-blocked` | |
| `.driver-allowed-element` | `.vt-extra` | |
| `.driver-layer` | `.vt-layer` | |
| `.driver-live-region` | `.vt-live-region` | |
| `.driver-popover` | `.vt-popover` | The popover wrapper. |
| `.driver-popover-*` | `.vt-popover-*` | Every popover class keeps its suffix: `.driver-popover-title` is `.vt-popover-title`. |

CSS custom properties follow the same rule. `--driver-popover-font-family` is `--vt-popover-font-family`. See [Styling](../guide/styling) for the full list.

## Behavior differences

These change what users see even when every option is translated.

- **No overlay by default.** driver.js always dims the page. Set `dim: true` (or a `dim` object) to get an overlay.
- **No placement means centered.** driver.js defaults to side `bottom`, align `start`. A step with a target and no `placement` highlights the target and centers the popover. Set `placement` for a popover beside the target.
- **Flip is on by default and goes further.** driver.js falls back to another side when the popover does not fit, and cannot be told not to. VirtualTour does this by default through `position.flip`, also flips `start` to `end` along the edge when that helps, and lets you turn both off with `flip: false`. `position.shift` slides the popover along the edge to stay inside the boundary and is also on by default. See [Positioning](../guide/positioning).
- **The boundary follows scroll parents.** driver.js keeps the popover inside the window. VirtualTour keeps it inside the window narrowed by the target's scrolling ancestors. Set `position.boundary: 'viewport'` for the old rule.
- **Alignment is logical.** `start` and `end` mirror in right-to-left layouts, and `position.offset.cross` mirrors with them.
- **Scroll lock is opt-in.** driver.js always froze a scrollable parent of the target. VirtualTour leaves it scrolling, and the popover and cut-out follow. Set `dim.lockScrollParent: true` to freeze it. `dim.pageScroll: false` still locks the page itself. See [Scroll lock](../cookbook/scroll-lock).
- **Clicks on the dimmed area do nothing.** driver.js closes the tour. Set `dim.clickOutside: 'exit'` to match.
- **The cut-out is clipped.** Where a scroll parent hides part of the target, VirtualTour cuts out only the visible part. Set `dim.clipToScrollParents: false` for the full rectangle.
- **Escape and arrows are separate.** `keys.escape` and `keys.arrows` replace `allowKeyboardControl`.
- **One tour at a time.** Starting a tour ends the running one with `exited` and reason `replaced`, as driver.js does, and the registry (`tours`) tells you which is current.
- **Content can be more than a string.** `body` accepts elements and functions. Strings are still HTML, so set `sanitize` if any text is not yours. See [Sanitizing HTML](../cookbook/sanitizing-html).

Two of the translated defaults are worth restoring explicitly when you want driver.js behavior:

<<< @/snippets/migration/old-defaults.ts

## Confirming before closing

driver.js does this in `onDestroyStarted`. Set `exitPrompt` instead. A string uses `window.confirm`. A function may return a promise, and `tour.exit()` resolves `false` when the user declines.

<<< @/snippets/migration/exit-prompt.ts

## New in VirtualTour

The action-step hooks `onStepCompleted` and `onNudge` are not in driver.js 1.12.1. Here, completion is the `completed` step event and the `step-completed` tour event. A nudge goes to the presenter's `onNudge`.

## What has no equivalent

- Hints and checklists. They were removed from the fork.
- `setConfig`, `getConfig`, `getState` and the standalone `highlight`.
- The `when` predicate of `advanceOn`, the `onInteraction` hook, and the function form of `overlayClickBehavior`.
- Per-button click hooks. Use a custom button with an `action`, or listen to events.
