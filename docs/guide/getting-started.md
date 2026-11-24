# Getting started

This page installs VirtualTour and builds a two-step tour: one step that points at a button and one centered step that ends the tour.

## Install

```sh
npm install virtual-site-tour
```

The package is not published to npm yet. Until it is, build it from the repository (`npm ci && npm run build`) and depend on `packages/core`. The command above is the intended install.

The package has no runtime dependencies. It is ESM only and ships these entry points:

| Import | What it is |
|---|---|
| `virtual-site-tour` | `createTour`, `tours`, the `Tour` and `TourStep` classes, the JSON helpers and the progress stores |
| `virtual-site-tour/base.css` | The functional stylesheet. Required. |
| `virtual-site-tour/theme.css` | Optional colors, spacing and dark mode |
| `virtual-site-tour/avatar` | The optional avatar and speech bubble. See [Avatar](../avatar/). |
| `virtual-site-tour/motion` | `glide` and `progressVars`. See [Motion](./motion). |

Without `base.css` the popover is unstyled. Import `virtual-site-tour/theme.css` as well if you want the default look:

<<< @/snippets/guide/first-tour-theme.ts

## The page

The tour points at an element with the id `save`:

```html
<button id="save">Save</button>
<button id="start-tour">Take the tour</button>
```

## Build the tour

<<< @/snippets/guide/first-tour.ts

- `dim: true` draws the overlay with a cut-out around the target. The default is no overlay.
- The first step has a `target`, so the popover sits below the button, aligned to its start edge. A step with a target and no `placement` highlights the target and centers the popover.
- The second step has no `target`, so its popover is centered on the page.
- `title` and `body` are HTML strings. Body can also be a list of paragraphs, an element, or a function. See [Steps and targets](./steps-and-targets).
- Ids are optional. Steps without one are numbered `step-1`, `step-2` and so on. Give a step an id when you want to find it again with `tour.stepById` or save progress by step.

`tour.start()` returns a promise that resolves once the first step is shown. It rejects when there is no browser document, so call it from client code only.

## What the user sees

1. Pressing the start button shows the first step next to `#save`. The page behind it is dimmed.
2. Next moves to the second step. Back returns to the first. Close, Escape and the arrow keys work as you would expect.
3. On the last step the Next button reads Done. Pressing it ends the tour.

## React to the tour

Every tour is an event emitter. `step-shown` fires each time a step appears, `finished` when the user passes the last step, and `exited` when the tour ends any other way. The `reason` is one of `close`, `escape`, `overlay`, `api` or `replaced`.

<<< @/snippets/guide/first-tour-events.ts

Each call to `on` returns a function that removes the handler. See [Events and lifecycle](./events-and-lifecycle) for the full list and their order.

## Next

- Place popovers precisely: [Positioning](./positioning).
- Describe a tour as data: [JSON tours](./json-tours).
- Restyle the popover: [Styling](./styling).
- Coming from driver.js: [Migration](../migration/from-driverjs).
