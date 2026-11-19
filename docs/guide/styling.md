# Styling

VirtualTour ships plain CSS and one naming contract. You import a stylesheet or two, override CSS variables, and target a stable set of classes and attributes. This page explains the moving parts. The complete tables of classes, attributes and variables live in [`packages/core/STYLES.md`](https://github.com/quaz579/virtualtour/blob/main/packages/core/STYLES.md). A test compares that file against the shipped CSS and the source, so it is the list to trust.

## Stylesheets

| Import | Needed | Purpose |
|---|---|---|
| `virtualtour/base.css` | Always | The engine's functional rules (overlay, pointer blocking, scroll lock) and a plain light popover. |
| `virtualtour/theme.css` | Optional | Variable-driven colors, dark mode, focus ring and an entrance animation. Import it after `base.css`. |
| `virtualtour/avatar.css` | With the avatar presenter | Lays out the speech bubble and avatar. Import it after the other two. |

Without `base.css` the popover is unstyled and the overlay does not block clicks. In a development build, `start()` logs one warning per tour when `base.css` is missing. The check reads the `--vt-base` custom property, which `base.css` sets on the popover. Do not override `--vt-base`. If you ship your own CSS in place of `base.css`, define `--vt-base: 1` on `.vt-popover` to silence the warning. Production builds never warn.

## Theme with variables

`theme.css` reads variables from `:root`, so setting them on `:root` or any ancestor of the popover restyles every popover. Your rules win over the theme's defaults, including in dark mode, because the theme's selectors have no specificity.

```css
:root {
  --vt-accent: #0f766e;
  --vt-radius: 12px;
  --vt-space: 20px;
}
```

The main variables are `--vt-accent`, `--vt-bg`, `--vt-fg`, `--vt-muted`, `--vt-radius`, `--vt-space`, `--vt-shadow`, `--vt-font` and `--vt-enter-duration`. STYLES.md lists them with their defaults, along with the engine variables from `base.css` such as `--vt-animation-duration`, `--vt-allowed-z-index` and the nudge, raised-highlight and instruction variables.

Dark mode follows `prefers-color-scheme`. Set `data-vt-theme="dark"` or `data-vt-theme="light"` on `<html>` to force one scheme regardless of the visitor's setting.

The entrance animation replaces the engine fade on the popover. Once `theme.css` is loaded, `--vt-enter-duration` times the popover entrance and `--vt-animation-duration` still times the overlay.

## Progress bar

The theme can draw a progress bar, but nothing turns it on. Add `data-vt-progress-bar` to the popover and set `--vt-progress-index` and `--vt-progress-total` on it yourself. The [custom counter recipe](../cookbook/custom-counter) shows a working setup.

## Mechanism attributes and classes

The engine puts state attributes on the page while a tour runs. The shipped CSS keys on the fixed `data-vt-*` attributes, and they never change with the namespace.

| Where | What it marks |
|---|---|
| `<body>` | `data-vt-active` while a tour runs, `data-vt-dim` when the overlay is on, `data-vt-fade` when animated |
| the target | `data-vt-target`, plus `data-vt-blocked` and `data-vt-raised` when they apply |
| extra elements | `data-vt-extra` |
| the overlay | `data-vt-overlay` |

The `namespace` option (default `vt`) prefixes the classes the engine adds to page elements, such as `<namespace>-active` on `<body>` and `<namespace>-spotlit` on the target and extras. The shipped CSS never uses those classes, so two tours with different namespaces can be styled independently. The popover itself keeps the fixed names `vt-popover` and `vt-popover-*`, and the ids `vt-popover-title`, `vt-popover-description` and `vt-popover-content`, whatever the namespace. For the full list, see STYLES.md.

You can add your own classes. A step's `classes` go on its popover, and `spotlight.class` goes on the target and extras.

## Scroll lock is opt-in

A tour does not stop the page from scrolling. Scroll lock is off until you ask for it with a `dim` option.

| Option | Effect |
|---|---|
| `dim.pageScroll: false` | Sets `data-vt-lock-scroll` and the `<namespace>-no-scroll` class on `<body>`. `base.css` sets `overflow: hidden` on it. |
| `dim.lockScrollParent: true` | Sets `data-vt-lock-scroll` on the target's direct parent when that parent scrolls. `base.css` sets `overflow: hidden !important` on it. |

`pageScroll: false` does not freeze the target's parent. Scrollers inside a shadow root or an iframe are not followed. See [Overlay](./overlay#scroll-lock) for details and [Scroll lock](../cookbook/scroll-lock) for doing it yourself.
