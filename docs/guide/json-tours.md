# JSON tours

A tour can live in a database or a CMS as a `virtualtour-tour/1` document. `parseTourJson` turns it into a plain `TourConfig`, and `serializeTour` writes one back. Only JSON values appear in the document: a function is a named handler, an element is a CSS selector. Some config keys cannot be written as JSON at all; see [Code-only keys](#code-only-keys) and [Caveats](#caveats).

<<< @/snippets/guide/json-parse.ts

The two schemas ship with the package for editor support and validation: `virtual-site-tour/schemas/tour.v1.schema.json` and `virtual-site-tour/schemas/avatar-pack.v1.schema.json`. Add `"$schema"` to a document to get completion in most editors; the parser ignores it. Worked documents live in `docs/examples/tours/`.

The smallest valid document has a `format` and a `steps` array:

```json
{
  "format": "virtualtour-tour/1",
  "steps": []
}
```

## API

| Member | What it does |
|---|---|
| `parseTourJson(json, { handlers })` | Takes the document as text or a parsed value and returns a `TourConfig`. Unknown keys, wrong types and unknown handler names throw `TourJsonError`. `extensions`, `meta` and button `attrs` pass through as they are. |
| `serializeTour(config, { handlerNames, elementSelectors })` | Writes a config as a document. Every function needs a name in `handlerNames` (a `Map` from function to name); every element needs a selector in `elementSelectors`. Anything else throws `TourJsonError`. |
| `TourJsonError` | Carries `path`, the JSON path of the offender, for example `steps[2].buttons[0].action.handler`. |
| `TourJsonV1` | TypeScript type of the document. |

## Handlers

`{ "handler": "name" }` is the only place a function appears. The function is used as is: handlers for `title`, `label`, `text`, `instruction` and `counter` return a string, `exitPrompt` returns a boolean or promise, `shouldShow` a boolean, and a button `action` handler receives `{ tour, step }`.

## Selectors

`target` is a selector string, resolved when the step shows. It can also be a handler that returns an element or a selector. `mountIn` and `dimMountIn` are selector strings that become functions. When the tour calls one and nothing matches, it throws `TourEnvironmentError` with the JSON path.

## Code-only keys

These keys, or these forms of a key, cannot be written as JSON. Set them on the config in code after parsing.

- `body` as an `Element`, a `DocumentFragment` or a function: JSON bodies are strings or lists of strings.
- `mountIn` as an element or a function you wrote: `serializeTour` writes an `Element` through `elementSelectors` and the function `parseTourJson` made back to its selector, but no other function.
- `dimMountIn` as an element or a function you wrote: the same rules as `mountIn`.
- `progress`: a progress store is code.
- `presenter`: a presenter factory is code.
- `sanitize`: a sanitizer is code.

## Caveats

- **Code-only keys come back unset.** A parsed config has no `progress`, `presenter` or `sanitize`. Add them in code before `createTour`, as below. Without `sanitize`, HTML in a document goes to the page as written, so sanitize any document that does not come from you.
- **Persistence needs step ids.** Progress and resume record the id of the step. Give every step an `id` in the document, and a tour `id` too, because the store keys on the tour id.
- **Parsed values are shared.** When you pass `parseTourJson` an already parsed object instead of text, the `meta`, `extensions` and button `attrs` objects in the result are the same objects you passed in. Changing one changes the other. Parse from text, or copy first, if you keep the source.
- **Selector targets are resolved late.** A bad `target` selector is not a parse error. It is judged when the step shows, like any selector target.
- **No `Infinity` or `NaN`.** `waitBudget` and `hookTimeout` use `0` for no limit in the engine; write `0` or a large finite number. `serializeTour` throws for `Infinity`.

<<< @/snippets/guide/json-code-only.ts

## Serializing

`serializeTour` checks `meta` and `extensions` for plain JSON values and throws with the path for functions, dates, `NaN` and the like.
