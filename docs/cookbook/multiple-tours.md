# Multiple tours on one page

Create as many tours as you like. Only one runs at a time. Give each its own `id` and, when their looks differ, its own `namespace`.

<<< @/snippets/cookbook/multiple-tours.ts

## One at a time

`start()` on a second tour ends the running one first. The first tour emits `exited` with reason `replaced`, then `deactivated`, and the second emits `started` and `activated`. A `replaced` exit is not saved as an exit in progress records. In the snippet, `billing.start()` replaces `welcome` at once.

`tours.current` is the running tour or `null`.

## Namespaces

`namespace` prefixes the classes the tour adds (`<ns>-active`, `<ns>-target` and so on) and the `data-<ns>-step` and `data-<ns>-side` attributes. Style each tour's popover through its own prefix. The mechanism attributes that the shipped stylesheet depends on, such as `data-vt-active` and `data-vt-lock-scroll`, stay `data-vt-*` for every namespace. An invalid namespace throws `TypeError`.

## Watching every tour

The `tours` registry relays every tour event, with the tour in the payload. Subscribe once to follow all tours.

| Member | Meaning |
|---|---|
| `tours.on(event, fn)` | Returns an unsubscribe function. |
| `tours.once(event, fn)` | Removed before its first call. |
| `tours.off(event?, fn?)` | Removes handlers. |

Saved progress is keyed by tour `id`, so tours that share a store must have different ids. See the [Tour reference](../api/tour).
