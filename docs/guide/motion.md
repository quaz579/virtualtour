# Motion

`virtual-site-tour/motion` holds two small helpers that add motion and progress styling to a tour without touching its config: `glide` slides the popover from one step to the next, and `progressVars` publishes the step position as CSS variables. Both take a tour, attach listeners and return a function that undoes everything. They live in a separate entry so tours that do not use them do not pay for them.

## glide

`glide(tour, options?)` replaces the engine's fade-in with a slide. When a step is shown, the popover starts where the previous step's popover was and travels to its new place.

<<< @/snippets/guide/motion-glide.ts

| Option | Type | Default | Meaning |
|---|---|---|---|
| `durationMs` | `number` | `250` | How long the popover travels. |
| `easing` | `string` | `cubic-bezier(.2,.8,.2,1)` | CSS easing for the travel. |

`glide` returns a function. Call it to release your hold on the glide; when every caller has released it, it stops listening and cancels a glide in progress. A glide stays attached across runs of the tour until you call it, so wire it to `deactivated` only if you want to stop for good.

### When it does nothing

`glide` skips the slide, and the popover appears the way it normally would, when any of these is true:

- The user prefers reduced motion.
- The tour's `animate` is `false`.
- It is the first step shown after a start, a restart or `hideCurrent`: there is no previous position.
- One of the two steps is centered and the other has a target.
- The two steps use different popover layouts.
- The new position equals the old one.

### Caveats

- **Calls on one tour share a glide.** `glide` is reference counted per tour. A second call on the same tour does not start a second animation: it joins the first, and the options of the first call win. Each call returns its own function, which counts only once. The glide stops when every function it handed out has been called, so one component turning its glide off does not cut another's.
- **It finishes the entrance animation.** To avoid a fade and a slide at once, `glide` finishes the engine's entrance animations on the new popover when it slides. When it skips the slide, it leaves them alone.

## progressVars

`progressVars(tour)` sets two CSS custom properties on the popover each time a step is shown, when `appendStep` or `dropStep` changes the step list under a step on screen, and right away when a step is already on screen:

| Property | Value |
|---|---|
| `--vt-progress-index` | The 1-based index of the step on screen. |
| `--vt-progress-total` | The number of steps in the tour at that moment. |

Use them in your own CSS to draw progress: a width, a ring, a row of dots. The function it returns stops updating and removes both properties.

### The built-in bar

`theme.css` has a rule that draws a thin bar along the bottom of the popover, as wide as `index / total`. It applies to a popover that carries the `data-vt-progress-bar` attribute. Nothing in the library sets that attribute: you set it yourself, usually in a `step-shown` handler.

<<< @/snippets/guide/motion-progress.ts

Set it on every `step-shown`, so it is present whether or not the engine reuses the popover element. The bar is hidden in the speaker layout, which has its own styling.

### Caveats

- **Follows step list changes.** The tour's `steps-changed` event rewrites both variables when you add or remove steps while a step is on screen, so the index and total stay current.
- **The total counts all steps.** Steps skipped by `shouldShow` or `whenMissing: 'skip'` still count, so the bar can jump over a slice.
- **Load the stylesheet.** Without `virtual-site-tour/theme.css` the attribute does nothing. The variables themselves work without it.

## Reduced motion

Neither helper animates for users who prefer reduced motion. The tour as a whole switches to its simple mode in that case: no fade, no tween, and nudges flash instead of shaking.
