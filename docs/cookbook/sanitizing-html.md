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

Strings with no `<` skip the hook. The hook runs once per distinct string for the life of a run; a string the hook already produced is not cleaned again.

If the hook throws, or returns something that is not a string, the original text is shown as plain text, not as HTML.

## Without a hook

With no `sanitize`, HTML strings are inserted as written. The library does not warn about this. Set a hook whenever any title or body can come from a user, a CMS or a URL. A sanitizer is code, so JSON tours cannot carry one: pass it with the parsed config.

## An example hook

This allow-list sanitizer keeps a few inline and list elements, drops everything else, and keeps `href` only for web, mail and same-site links. It is a starting point. For untrusted content, use a maintained sanitizer library and call it from the hook.

<<< @/snippets/cookbook/sanitize-config.ts

## Element bodies

A body that is an `Element` or `DocumentFragment` is cloned into the popover as it is. It is not passed through `sanitize`, so build it from trusted nodes only.

<<< @/snippets/cookbook/sanitize-element-body.ts

The hook above never sees the template's content.
