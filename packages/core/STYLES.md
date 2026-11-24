# Styles

VirtualTour ships three stylesheets and one stable naming contract.

| File | Import | Purpose |
|---|---|---|
| `base.css` | `virtual-site-tour/base.css` | Required. The engine's functional rules plus a plain, usable popover. |
| `theme.css` | `virtual-site-tour/theme.css` | Optional. Variable-driven colors, dark mode, focus ring and entrance animation. Import it after `base.css`. |
| `avatar.css` | `virtual-site-tour/avatar.css` | Only with `SpeakerPresenter`. Lays out the speech bubble and avatar. Import it after `base.css` and `theme.css`. |

Without `theme.css` the popover stays a plain light box. In a development build, `start()` logs a warning once per tour when `base.css` is missing.

## Theming

Set the variables on `:root` (or any ancestor of the popover) to restyle every popover. Your rules win over the theme's defaults, including in dark mode, because the theme selectors have zero specificity.

The theme sets the instruction and feedback variables in dark mode only; light mode uses the engine's built-in colors. The entrance animation replaces the engine fade on the popover, so `--vt-enter-duration` (not `--vt-animation-duration`) times it once `theme.css` is loaded.

Dark mode follows `prefers-color-scheme`. Set `data-vt-theme="dark"` or `data-vt-theme="light"` on `<html>` to force one scheme regardless of the visitor's setting.

| Variable | Default (light) | Used for |
|---|---|---|
| `--vt-accent` | `#2563eb` | Primary buttons, focus ring, progress bar |
| `--vt-bg` | `#ffffff` | Popover and button background, arrow |
| `--vt-fg` | `#1f2328` | Text |
| `--vt-muted` | `#59636e` | Progress text, close button, button borders, secondary buttons |
| `--vt-radius` | `8px` | Popover corners (buttons use half) |
| `--vt-space` | `16px` | Popover padding |
| `--vt-shadow` | two-layer shadow | Popover shadow |
| `--vt-font` | system UI stack | Popover font |
| `--vt-enter-duration` | `180ms` | Entrance animation |
| `--vt-progress-index` | `0` | Filled steps in the progress bar. Set it on the popover; nothing fills it yet |
| `--vt-progress-total` | `1` | Total steps in the progress bar. Set it on the popover; nothing fills it yet |

## Engine variables (`base.css`)

| Variable | Used for |
|---|---|
| `--vt-base` | Marker the missing-stylesheet check reads. Do not override. |
| `--vt-popover-font-family` | Popover font in `base.css` |
| `--vt-animation-duration` | Overlay and popover fade |
| `--vt-allowed-z-index` | Stacking of extra elements |
| `--vt-nudge-duration`, `--vt-nudge-distance`, `--vt-nudge-color` | Nudge animation |
| `--vt-raised-highlight-width`, `--vt-raised-highlight-color`, `--vt-raised-highlight-offset`, `--vt-raised-highlight-background` | Outline on raised targets |
| `--vt-instruction-background`, `--vt-instruction-color`, `--vt-instruction-padding`, `--vt-instruction-radius`, `--vt-instruction-indicator-color`, `--vt-instruction-indicator-size`, `--vt-instruction-next-color`, `--vt-instruction-done-background`, `--vt-instruction-done-color` | Instruction strip on action steps |
| `--vt-feedback-color` | Feedback line |

## Avatar variables (`avatar.css`)

| Variable | Default | Used for |
|---|---|---|
| `--vt-avatar-base` | `1` | Marker the missing-stylesheet check reads. Do not override. |
| `--vt-avatar-gap` | `8px` | Space between the bubble and the avatar. The presenter sets it from the pack's `bubble.gap` when the pack has one. |

The bubble reads `--vt-bg`, `--vt-space`, `--vt-radius` and `--vt-shadow` from the theme and falls back to the `base.css` look without it.

## Attributes

| Attribute | Where | Meaning |
|---|---|---|
| `data-vt-active` | `<body>` | A tour is running |
| `data-vt-dim` | `<body>` | Overlay is on |
| `data-vt-fade` | `<body>` | Animated (fade and entrance) |
| `data-vt-lock-scroll` | `<body>`, target parent | Scrolling disabled |
| `data-vt-target` | target | The spotlit element |
| `data-vt-blocked` | target | Clicks blocked |
| `data-vt-raised` | target | Raised above the overlay |
| `data-vt-extra` | extra element | Allowed alongside the target |
| `data-vt-target-parent` | target's parent | Scroll lock root |
| `data-vt-overlay` | overlay SVG | The dimming overlay |
| `data-vt-layer` | `<dialog>` | The dialog layer |
| `data-vt-strategy` | popover | `absolute` when positioned inside a transformed container |
| `data-vt-dock` | speaker popover | `start` or `end`: the inline edge of the bubble the avatar sits on, or above (`start`) and below (`end`) it beside a left or right popover. Written by the presenter, which resolves `auto`. |
| `data-vt-side` | speaker popover | `top`, `bottom`, `left`, `right` or `over`: the side the popover ended on, `over` when no side fit and it was pinned to the viewport. Written by the presenter after every reposition, whatever the tour's namespace. |
| `data-vt-anim` | avatar | Name of the animation the sprite player is showing, the pack's `rest` animation when it stands still. Written by the player; style on it only to hide or restyle a pose. |

## Classes

### Popover

`vt-popover`, `vt-popover-side-*`, `vt-popover-align-*`, `vt-popover-rtl`, `vt-no-arrow`, `vt-popover-waiting`, `vt-waiting`, `vt-popover-nudge`, `vt-popover-has-instruction`, `vt-popover-instruction-done`, `vt-dialog`

### Parts

| Part | Classes |
|---|---|
| Title, close, description | `vt-popover-title`, `vt-popover-close-btn`, `vt-popover-description` |
| Body (Element content) | `vt-body` |
| Footer | `vt-popover-footer`, `vt-popover-progress-text`, `vt-popover-navigation-btns`, `vt-popover-prev-btn`, `vt-popover-next-btn`, `vt-popover-footer-btn`, `vt-popover-done-btn`, `vt-popover-btn-disabled` |
| Custom buttons | `vt-footer`, `vt-button`, `vt-button--secondary` |
| Instruction and feedback | `vt-popover-instruction`, `vt-popover-instruction-text`, `vt-popover-instruction-indicator`, `vt-popover-feedback` |
| Arrow | `vt-popover-arrow`, `vt-popover-arrow-side-*`, `vt-popover-arrow-none` |
| Speaker | `vt-speaker`, `vt-speaker--no-avatar`, `vt-bubble`, `vt-bubble-tail`, `vt-avatar-slot`, `vt-avatar` |
| Dialog layer | `vt-layer` |
| Live region | `vt-live-region` |

### Namespaced (prefix is the `namespace` option, default `vt`)

`<ns>-active`, `<ns>-fade`, `<ns>-simple`, `<ns>-no-scroll`, `<ns>-overlay`, `<ns>-overlay-animated`, `<ns>-target`, `<ns>-target-blocked`, `<ns>-target-raised`, `<ns>-extra`, `<ns>-target-parent`, `<ns>-spotlit`

The shipped stylesheets never use the namespaced classes, so two tours with different namespaces can be styled independently. Popover wrappers also carry `data-<ns>-step` (step index) and `data-<ns>-side`. The speaker presenter also writes the fixed `data-vt-side` that `avatar.css` reads, so avatar styling does not depend on the namespace.

### Author-applied

Names you set yourself. The engine never emits them.

| Name | Where | Effect |
|---|---|---|
| `data-vt-theme` | `<html>` | `dark` or `light` forces a scheme |
| `data-vt-progress-bar` | popover | Shows the progress bar; `--vt-progress-index` and `--vt-progress-total` set its width |

### Avatar mode

With `SpeakerPresenter` the popover wrapper carries `vt-speaker` and holds, in order, the arrow (`vt-popover-arrow vt-bubble-tail`), `vt-bubble` (title, description, body, instruction and footer) and `vt-avatar-slot`. The presenter moves one `vt-avatar` element (`aria-hidden`, never focusable) into the slot of each step. `vt-speaker--no-avatar` marks a step that sets `extensions.avatar.hidden`; its slot is hidden.

The tail is positioned against the bubble's edge, so the bubble sits flush on the edge that faces the target and the avatar hangs off the other side, however tall or wide it is.
