# Styles

VirtualTour ships two stylesheets and one stable naming contract.

| File | Import | Purpose |
|---|---|---|
| `base.css` | `virtualtour/base.css` | Required. The engine's functional rules plus a plain, usable popover. |
| `theme.css` | `virtualtour/theme.css` | Optional. Variable-driven colors, dark mode, focus ring and entrance animation. Import it after `base.css`. |

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
| Dialog layer | `vt-layer` |
| Live region | `vt-live-region` |

### Namespaced (prefix is the `namespace` option, default `vt`)

`<ns>-active`, `<ns>-fade`, `<ns>-simple`, `<ns>-no-scroll`, `<ns>-overlay`, `<ns>-overlay-animated`, `<ns>-target`, `<ns>-target-blocked`, `<ns>-target-raised`, `<ns>-extra`, `<ns>-target-parent`, `<ns>-spotlit`

The shipped stylesheets never use the namespaced classes, so two tours with different namespaces can be styled independently. Popover wrappers also carry `data-<ns>-step` (step index) and `data-<ns>-side`.

### Author-applied

Names you set yourself. The engine never emits them.

| Name | Where | Effect |
|---|---|---|
| `data-vt-theme` | `<html>` | `dark` or `light` forces a scheme |
| `data-vt-progress-bar` | popover | Shows the progress bar; `--vt-progress-index` and `--vt-progress-total` set its width |

### Reserved (avatar mode)

`vt-speaker`, `vt-bubble`, `vt-bubble-tail`, `vt-avatar-slot`, `vt-avatar`, `data-vt-dock`. Not emitted yet.
