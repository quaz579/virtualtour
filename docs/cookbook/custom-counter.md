# Custom counter and progress bar

Two ways to show where the user is in a tour without writing your own popover.

## Counter text

Set `counter` to `true` for "2 of 5", or to a function that returns the text. The function receives the 1-based index and the step count, skipped steps included.

```ts
createTour({ counter: (index, total) => `Step ${index} of ${total}`, steps });
```

## Your own element

Read `tour.progressInfo()` from `step-shown` to drive anything on the page.

```ts
tour.on("step-shown", () => {
  const { index, total } = tour.progressInfo();
  badge.textContent = `${index}/${total}`;
});
```

## Progress bar from CSS variables

`progressVars` sets `--vt-progress-index` and `--vt-progress-total` on the popover each time a step is shown. It returns a function that stops updating and removes them. The theme stylesheet draws a bar from the two variables on a popover that has `data-vt-progress-bar`; any other stylesheet can use them too.

```ts
import { progressVars } from "virtualtour/motion";

const off = progressVars(tour);
tour.on("step-shown", ({ step }) => step.element?.setAttribute("data-vt-progress-bar", ""));
```

Any rule can use the variables:

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

## Glide between steps

`glide(tour, { durationMs, easing })` slides the popover from the previous step's position to the next instead of fading it in. It does nothing under reduced motion, when the tour has `animate: false`, between a centered and a targeted step, or between popover layouts. It returns a function that stops listening.

```ts
import { glide } from "virtualtour/motion";

const off = glide(tour, { durationMs: 300 });
```
