# Styling contract

Placeholder: the full styling guide arrives with the docs work. The complete class, attribute and variable contract, including the optional `theme.css` and dark mode, is in `packages/core/STYLES.md`. This page lists the names the engine adds to the page.

## Mechanism attributes (fixed)

The shipped stylesheet keys on these. They never change with the namespace.

| Element | Attributes |
|---|---|
| `<body>` | `data-vt-active`, `data-vt-dim` (overlay on), `data-vt-fade` (animated), `data-vt-lock-scroll` (scrolling disabled) |
| target | `data-vt-target`, `data-vt-blocked`, `data-vt-raised` |
| extra element | `data-vt-extra` |
| target's parent | `data-vt-target-parent`, `data-vt-lock-scroll` |
| overlay SVG | `data-vt-overlay` |
| `<dialog>` layer | `data-vt-layer` |

## Styling classes (prefixed by the `namespace` option, default `vt`)

| Element | Classes |
|---|---|
| `<body>` | `<ns>-active`, `<ns>-fade` or `<ns>-simple`, `<ns>-no-scroll` |
| target | `<ns>-target`, `<ns>-target-blocked`, `<ns>-target-raised` |
| extra element | `<ns>-extra` |
| target's parent | `<ns>-target-parent` |
| overlay SVG | `<ns>-overlay`, `<ns>-overlay-animated` |
| popover wrapper | attributes `data-<ns>-step` (step index) and `data-<ns>-side` |

No shipped CSS references these, so two tours with different namespaces can be styled independently.

## Fixed popover names

The popover keeps `vt-popover` and its `vt-popover-*` parts (title, description, footer, buttons, arrow, instruction, feedback), plus the ids `vt-popover-content`, `vt-popover-title` and `vt-popover-description`. They are not namespaced because the stylesheet is static.

## CSS variables

`--vt-animation-duration`, `--vt-nudge-duration`, `--vt-nudge-distance`, `--vt-nudge-color`, `--vt-allowed-z-index`, `--vt-raised-highlight-*`, `--vt-instruction-*`, `--vt-feedback-color`, `--vt-popover-font-family`.
