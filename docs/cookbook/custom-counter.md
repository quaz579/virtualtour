# Custom counter and progress bar

Three ways to show where the user is in a tour without writing your own popover: counter text, your own element, and a progress bar drawn from CSS variables.

## Counter text

Set `counter` to `true` for "2 of 5", or to a function that returns the text. The function receives the 1-based index and the step count, skipped steps included. The text goes through the tour's `sanitize` hook when it contains markup.

<<< @/snippets/cookbook/counter-text.ts

## Your own element

`tour.progressInfo()` returns `{ index, total }`. Read it from `step-shown` to drive anything on the page. `index` is 0 while no step is on screen.

<<< @/snippets/cookbook/counter-badge.ts

## Progress bar from CSS variables

`progressVars(tour)` from `virtualtour/motion` sets `--vt-progress-index` and `--vt-progress-total` on the popover each time a step is shown, and right away when a step is already on screen. It returns a function that stops updating and removes the variables.

The theme stylesheet draws a bar from the two variables, but only on a popover that has the `data-vt-progress-bar` attribute. `progressVars` does not set that attribute. You set it, for example from `step-shown`:

<<< @/snippets/cookbook/progress-bar.ts

Any stylesheet can use the variables, with or without the attribute:

```css
.vt-popover::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: calc(var(--vt-progress-index) / var(--vt-progress-total) * 100%);
  background: var(--vt-accent, #2563eb);
}
```

The variables are written when a step is shown. If you call `appendStep` or `dropStep` while a step is on screen, the values on that popover are stale until the next step shows.

## Glide between steps

`glide(tour, { durationMs, easing })` slides the popover from the previous step's position to the next instead of fading it in. The defaults are 250 ms and `cubic-bezier(.2,.8,.2,1)`. It does nothing under reduced motion, when the tour has `animate: false`, between a centered and a targeted step, or between popover layouts. It returns a function that stops listening and cancels a glide in progress.

<<< @/snippets/cookbook/glide.ts

Call `glide` once per tour. Two calls on the same tour do not compose.
