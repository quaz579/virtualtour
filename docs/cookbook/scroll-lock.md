# Scroll lock

By default a tour does not stop the page from scrolling. This page shows how to lock scrolling during a step, and how to do it yourself when the built-in option is not enough.

## Lock through the config

Scroll lock is part of the overlay options, so it needs `dim` set to an object.

| Option | Default | Effect |
|---|---|---|
| `dim.pageScroll` | `true` | `false` adds `data-vt-lock-scroll` to `<body>`, and the shipped stylesheet sets `overflow: hidden` on it. The `<ns>-no-scroll` class is added too. |
| `dim.lockScrollParent` | `false` | `true` adds `data-vt-lock-scroll` to the target's direct parent when that parent scrolls, and the stylesheet sets `overflow: hidden !important` on it. |

The two are independent. `pageScroll: false` does not freeze the target's parent, and `lockScrollParent` does not touch the page.

<<< @/snippets/cookbook/scroll-lock-config.ts

Limits:

- Only the target's direct parent is locked, not every scrolling ancestor.
- Scrollers inside a shadow root or an iframe are not followed.
- `dim: false` draws no overlay, and its scroll options keep their defaults. Use the next section when you want a lock without an overlay.
- The lock needs the stylesheet from `virtualtour/base.css`. The attribute name is `data-vt-lock-scroll` whatever the namespace.

## Lock the body yourself

Set `overflow` on `<body>` when the tour starts and restore it when the run ends. `deactivated` is the last event of every run, so it covers finish, exit and replacement.

<<< @/snippets/cookbook/scroll-lock-own.ts

If your page already styles `<body>` overflow, restore the value you saved rather than clearing it, as the snippet does.
