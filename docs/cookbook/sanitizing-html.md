# Sanitizing HTML

Titles, bodies and several other strings are HTML. Set `sanitize` on the tour to clean every one of them before it reaches the page. The hook takes an HTML string and returns an HTML string.

## What goes through it

| Passes through `sanitize` | Does not |
|---|---|
| `title` | An `Element` or `DocumentFragment` body |
| `body` as a string, as a string array (each paragraph) or returned by a function | `label` and the close button label (set as attributes) |
| `instruction` and the message of `nudge()` | Text you place in the page yourself |
| Counter text, and the `next`, `back` and `done` labels | |
| Custom button `text` | |

For `title` and `body`, the hook runs on every string, including plain text. Button labels, `instruction` and the other strings the engine inserts itself skip the hook when they contain no `<`. Check the result of your hook for plain text too.

If the hook throws, or returns something other than a string, while a step's `title` or `body` is built, the tour logs an error with `console.error` and shows that text as plain text, escaped, so the tour still starts. The `instruction`, the `nudge()` message, the feedback row and button labels fall back to plain text without a log, as does a counter's text when it contains markup and the hook fails. An array `body` whose hook fails is shown as one line of escaped text. A counter function that throws, or returns something other than a string, is logged and the step shows the default `N of M` counter instead.

## Without a hook

With no `sanitize`, HTML strings are inserted as written. The library does not warn about this. Set a hook whenever any title or body can come from a user, a CMS or a URL. A sanitizer is code, so JSON tours cannot carry one: pass it with the parsed config.

## An example hook

This allow-list sanitizer keeps a few inline and list elements, drops everything else, and keeps `href` only for web, mail and same-site links. It is a starting point. For untrusted content, use a maintained sanitizer library and call it from the hook.

<<< @/snippets/cookbook/sanitize-config.ts

## Element bodies

A body that is an `Element` or `DocumentFragment` is cloned into the popover as it is. It is not passed through `sanitize`, so build it from trusted nodes only.

<<< @/snippets/cookbook/sanitize-element-body.ts

The hook above never sees the template's content.
