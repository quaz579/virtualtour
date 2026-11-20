# Positioning

The popover sits next to the target on one side, lined up along one edge. This page covers every placement option, how the popover moves when there is no room, and what you can read back after it settles.

## Side and alignment

Set `placement` on a step.

| Value | Meaning |
|---|---|
| `{ side, align }` | `side` is `top`, `bottom`, `left`, `right`, `auto` or `over`. `align` is `start`, `center` or `end` and defaults to `start`. |
| `"auto"` | Same as `{ side: "auto" }`. |
| omitted, with a target | Same as `{ side: "over" }`. |
| omitted, no target | The popover is centered in the viewport. |

`over` highlights the target but centers the popover in the viewport instead of next to it. A step without a target is always centered, whatever `placement` says, and has no arrow.

`align` is logical. For `top` and `bottom`, `start` is the inline-start edge, so it is the left edge in left-to-right pages and the right edge in right-to-left pages. For `left` and `right`, `start` is the top edge and `end` the bottom edge.

<<< @/snippets/guide/positioning-placement.ts

### side: auto

`auto` picks the side with the most free space inside the boundary. Ties go in the order bottom, top, right, left (bottom, top, left, right in right-to-left pages). If the roomiest side cannot hold the popover, the next roomiest is tried, and so on. Free space is measured against the boundary first and against the viewport only when no side fits inside the boundary.

An explicit side that does not fit tries the others in the fixed order left, right, top, bottom (right, left, top, bottom in right-to-left pages).

## Flip, shift and padding

| Option | Type | Default | Meaning |
|---|---|---|---|
| `flip` | `boolean` | `true` | When the popover does not fit, move to another side. Along the edge, switch `start` to `end` or the reverse when only the opposite fits. `center` has no opposite. |
| `shift` | `boolean` | `true` | Slide the popover along the edge so it stays inside the boundary. `false` lets it cross the edge. |
| `viewportPadding` | `number` | `0` | Distance kept between the popover and the boundary edges. |

These options go under `position` on a step or in `stepDefaults`.

Flip is on by default. It is a deliberate difference from driver.js, covered in [Migrating from driver.js](../migration/from-driverjs). Set `flip: false` to keep the requested side.

With `flip: false` the popover stays on the requested side even when it overflows. With `flip` on and no side fitting anywhere, the popover is pinned to the bottom center of the viewport and its arrow is hidden. The `pinned` field below reports this.

<<< @/snippets/guide/positioning-flip-shift.ts

## Offset

`offset` is a number (the main gap) or `{ main, cross }`.

| Part | Default | Meaning |
|---|---|---|
| `main` | `10` | Gap between the highlight and the popover. |
| `cross` | `0` | Slides the popover along the edge it sits on. |

The gap is measured from the edge of the cut-out, so it adds to the spotlight padding (10 by default). With defaults the popover sits 20 px from the target. Alignment also lines up with the padded edge. This holds with `dim: false` too, because the padding falls back to `dim.padding`.

For `top` and `bottom`, a positive `cross` moves toward inline-end: to the right in left-to-right pages, to the left in right-to-left pages. For `left` and `right`, a positive `cross` moves down. Offsets are applied before `shift` clamps the popover, so a large `cross` is pulled back inside the boundary. `cross` is ignored for `over` and for centered steps. Values that are not finite numbers fall back to the default.

<<< @/snippets/guide/positioning-offset.ts

## Boundary

`boundary` decides what the popover must stay inside.

| Value | Meaning |
|---|---|
| `scrollParents` (default) | The viewport narrowed by the target's scrolling ancestors. A target inside a scrolling list keeps its popover inside that list. |
| `viewport` | The viewport only. Scrollers are ignored. |

If a scroller is too small for the popover on one axis, that axis uses the viewport. If no side fits inside the scroller, the popover falls back to the viewport. Only scrollers reachable through the element tree count: a scroller behind a shadow root or an iframe is not followed.

<<< @/snippets/guide/positioning-boundary.ts

## Arrow

| Option | Meaning |
|---|---|
| `arrow: false` | Hides the arrow. The popover gets the `vt-no-arrow` class. |
| `arrow: { minInset }` | The closest the arrow gets to a corner of the popover, in pixels. Default `15`. A negative or non-finite value falls back to `15`. |

The arrow points at the target and stays at least `minInset` from the corners of the popover. It is hidden for `over`, centered steps and pinned popovers.

<<< @/snippets/guide/positioning-arrow.ts

## Strategy

`strategy` is `fixed` (default) or `absolute`. It is read only from `position.strategy` on a step, which includes `stepDefaults.position`. There is no tour-level option.

Use `absolute` when the popover lives inside a container that creates its own coordinate space, such as a transformed pane, where `fixed` coordinates would be wrong. See [Containers](./containers). The popover gets `data-vt-strategy="absolute"` and its coordinates are written relative to that container.

Centered steps and `over` ignore `absolute` and stay `fixed`. When the next step is centered, the popover switches back to `fixed`.

<<< @/snippets/guide/positioning-strategy.ts

## Right-to-left pages

Direction is read from the computed `direction` of the target element. In right-to-left layouts:

- `start` and `end` swap edges for `top` and `bottom` popovers.
- A positive `offset.cross` moves left.
- The fallback order for an explicit side and the `auto` tie-break try the right side before the left, as listed above.
- The popover gets the `vt-popover-rtl` class.
- If the popover's own inherited direction differs from the target's (for example a `mountIn` container with the opposite `dir`), the popover wrapper gets a matching `dir` attribute while the step has a real target (steps with no target keep the inherited direction), so its content, close button and speaker dock follow the same direction that `align` is resolved in. The previous `dir` value, if one was set, is restored when the adoption ends.
- A step with no target has no real anchor, so `info.rtl` and the `vt-popover-rtl` class come from the page direction (the body-level placeholder anchor), while the rendered content follows the direction of the container the popover is mounted in. With a `mountIn` container whose direction differs from the page, these two can disagree.
- Alignment flips (`flip`) swap `start` and `end`, not `left` and `right`, so `align` and `physicalAlign` stay consistent after a flip.

## Read back where the popover landed

A presenter receives a `RepositionInfo` after every positioning pass. Use it to draw your own pointer or to style by side.

| Field | Meaning |
|---|---|
| `side` | The side used: `top`, `bottom`, `left`, `right` or `over`. When `pinned` is true this is the requested side, not where the popover sits. |
| `align` | The logical alignment actually used, after any flip. |
| `physicalAlign` | `align` resolved to an edge: `left` or `right` for `top` and `bottom` sides (swapped in right-to-left pages), `top` or `bottom` for `left` and `right`, `center` otherwise (always `center` for `over` and for a pinned popover). |
| `rtl` | Whether the target is laid out right to left. For a targetless step it is the page direction, not the mount container's. |
| `pinned` | True when no side fit and the popover is pinned to the bottom center of the viewport with no arrow. |
| `wrapperRect` | Bounds of the popover wrapper. |
| `bubbleRect` | The visible bubble. Equals `wrapperRect` for layouts without one. |
| `targetRect` | Bounds of the target, or `null` for a step with no target. |

<<< @/snippets/guide/positioning-reposition.ts

The popover wrapper also carries `data-<namespace>-side`, set to the side used. See [Presenters](./presenters) for how to build a full presenter.

Next: [Overlay](./overlay).
