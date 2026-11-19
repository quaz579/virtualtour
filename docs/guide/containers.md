# Containers and position strategy

## Mount containers

`mountIn` inserts the popover into an element instead of `document.body`. `dimMountIn` does the same for the overlay. Both must be elements of the current document, outside any shadow root.

## Position strategy

`position.strategy` chooses how the popover is placed.

| Strategy | Coordinates are relative to | Use it when |
|---|---|---|
| `fixed` (default) | the viewport, unless an ancestor creates a containing block | the popover mounts in `document.body` or in a plain container |
| `absolute` | the popover's containing block | an ancestor has `transform`, `filter` or `contain: paint`, or the container sits away from the page origin |

A `transform`, `filter` or `contain: paint` on an ancestor of the popover turns that ancestor into the containing block for `fixed` descendants, so a `fixed` popover lands offset from its target. With `strategy: 'absolute'` the engine measures the containing block and writes `top` and `left` relative to it, so the popover stays next to the target, including after the page scrolls.

Centered steps always use `fixed`, whatever the strategy.

## Unsupported pairings

- **Scrolling `mountIn` with an overlay.** The overlay stays `position: fixed` and covers the viewport. Inside a scrolling container it can look detached from the content. Use `dim: false` or mount in a container that does not scroll.
- **`dimMountIn` inside a containing block.** A container with `transform`, `filter` or `contain: paint` offsets the overlay, and the strategy option does not move it.
- **Scaled containers.** A `transform: scale()` ancestor changes the length of a pixel inside it. `absolute` assumes a scale of 1.
