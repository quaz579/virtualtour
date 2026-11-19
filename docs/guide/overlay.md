# Overlay

The overlay dims the page and cuts a hole around the highlighted element. It is off by default. This page covers the dim options, what stays clickable, and the scroll lock options.

## Turn the overlay on

`dim` takes a boolean or an options object.

| Value | Result |
|---|---|
| `false` (default) | No overlay. The popover appears next to the target and the page stays fully interactive. |
| `true` | Overlay with every default below. |
| Object | Overlay with those options. Unset options keep their defaults. |

With `dim: false` there is nothing to click on, so `clickOutside`, the scroll options and the color options do not apply, and you cannot set them. The target still gets its state classes, and the spotlight padding still sets the gap between target and popover (see [Positioning](./positioning#offset)).

<<< @/snippets/guide/overlay-dim.ts

## Dim options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `padding` | `number` | `10` | Space between the target and the edge of the cut-out. |
| `radius` | `number \| { topLeft?, topRight?, bottomRight?, bottomLeft? }` | `5` | Corner radius of the cut-out in pixels. Missing corners in an object use `5`. A radius larger than half the shorter side of the cut-out is reduced to fit. |
| `transitionMs` | `number` | `400` | How long the cut-out takes to move between steps. It also times the overlay's fade-in. |
| `color` | `string` | `#000` | Overlay color. |
| `opacity` | `number` | `0.7` | Overlay opacity from 0 to 1. |
| `clickOutside` | `"none" \| "exit" \| "forward"` | `"none"` | What a click on the dimmed area does. `none` swallows the click. `exit` closes the tour like the close button does, through the exit prompt. `forward` moves to the next step. |
| `pageScroll` | `boolean` | `true` | `false` locks page scrolling. See [Scroll lock](#scroll-lock). |
| `lockScrollParent` | `boolean` | `false` | `true` freezes the target's scrolling parent. |
| `clipToScrollParents` | `boolean` | `true` | Cut out only the part of the target that its scrolling ancestors leave visible. |

With `animate: false`, or when the visitor prefers reduced motion, the cut-out jumps instead of moving and nothing fades.

A click on the dimmed area while an [action step](./action-steps) is waiting for the user nudges the popover instead of exiting or moving on.

## Per-step cut-out

A step's `spotlight` options override the tour's dim options for that step and add extras.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `padding` | `number` | `dim.padding` | Overrides the padding for this step. |
| `radius` | `number \| CornerRadius` | `dim.radius` | Overrides the radius for this step. Missing corners in an object fall back to the tour's radius for that corner. |
| `extra` | `string[]` | `[]` | Selectors of more elements to cut out and keep interactive. |
| `class` | `string` | none | Class added to the target and the extras. |
| `targetInteractive` | `boolean \| "hover-only"` | `true` | `false` blocks all interaction with the target. `hover-only` allows hover but not clicks. |

Padding and radius are zero for a centered step and for a target that sits inside an extra.

### Extras

Use `extra` when the user needs to reach more than the target, for example a search box next to the highlighted filter bar.

- Each match is cut out at its exact box, without padding or rounded corners, and stays clickable and focusable.
- Matches get the `data-vt-extra` attribute and the `<namespace>-extra` and `<namespace>-spotlit` classes, plus your `class`. See [Styling](./styling).
- The tour re-resolves the selectors when the page changes, so an extra that appears later gets cut out. Its state classes arrive on the next reposition.
- Extras inside the target, or inside another extra, add no extra hole.
- Selectors are matched with `querySelectorAll` on the document, so an element inside a shadow root is not found. A selector that does not parse is ignored.
- Tab moves through the popover, the target and the extras in turn. See [Keyboard and focus](./keyboard-and-focus).

<<< @/snippets/guide/overlay-extras.ts

## Click outside

<<< @/snippets/guide/overlay-click-outside.ts

## Scroll lock

Scroll lock is opt-in. By default the page and the target's scrolling parent keep scrolling, and the popover and the cut-out follow them.

| Option | Effect |
|---|---|
| `pageScroll: false` | Adds `data-vt-lock-scroll` and the `<namespace>-no-scroll` class to `<body>`. The stylesheet sets `overflow: hidden` there. |
| `lockScrollParent: true` | Adds `data-vt-lock-scroll` to the target's direct parent when that parent scrolls (`overflow` of `auto` or `scroll`). The stylesheet sets `overflow: hidden !important` there. |

The two options are independent. `pageScroll: false` does not freeze the target's parent, and `lockScrollParent` does not touch the page. Both are released when the run ends or the popover is hidden.

Limits:

- Only the target's direct parent is locked, not every scrolling ancestor.
- The lock comes from `virtualtour/base.css`. Without it the attributes are set but nothing is frozen.
- The lock only exists while the overlay is drawn, because the options live under `dim`. For a lock with `dim: false`, set `overflow` yourself. See [Scroll lock](../cookbook/scroll-lock).
- A scroller inside a shadow root or an iframe is not followed. The cut-out is not clipped to it, the popover boundary ignores it, and the tour is not told when it scrolls. Call `tour.refresh()` after you scroll it from code.

<<< @/snippets/guide/overlay-scroll.ts

Next: [Events and lifecycle](./events-and-lifecycle).
