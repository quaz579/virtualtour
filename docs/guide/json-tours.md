# JSON tours

Stub: the full guide arrives with the docs work. This page lists the format and every public member of the JSON API.

A tour can live in a database or a CMS as a `virtualtour-tour/1` document. `parseTourJson` turns it into a plain `TourConfig`, and `serializeTour` writes one back. Only JSON values appear in the document: a function is a named handler, an element is a CSS selector.

```ts
import { createTour, parseTourJson } from "virtualtour";

const tour = createTour(
  parseTourJson(documentText, {
    handlers: { confirmExit: () => confirm("Leave the tour?"), openSettings: () => openSettingsPanel() },
  }),
);
await tour.start();
```

Both schemas ship with the package for editor support and validation: `virtualtour/schemas/tour.v1.schema.json` and `virtualtour/schemas/avatar-pack.v1.schema.json`. Add `"$schema"` to a document to get completion in most editors; the parser ignores it. Worked documents live in `docs/examples/tours/`.

## API

| Member | What it does |
|---|---|
| `parseTourJson(json, { handlers })` | Takes the document as text or a parsed value and returns a `TourConfig`. Unknown keys, wrong types and unknown handler names throw `TourJsonError`. `extensions` and `meta` pass through untouched. |
| `serializeTour(config, { handlerNames, elementSelectors })` | Writes a config as a document. Every function needs a name in `handlerNames` (a `Map` from function to name); every element needs a selector in `elementSelectors`. Anything else throws `TourJsonError`. |
| `TourJsonError` | Carries `path`, the JSON path of the offender, for example `steps[2].buttons[0].action.handler`. |
| `TourJsonV1` | TypeScript type of the document. |

## Handlers

`{ "handler": "name" }` is the only place a function appears. The function is used as is: handlers for `title`, `label`, `text`, `instruction` and `counter` return a string, `exitPrompt` returns a boolean or promise, `shouldShow` a boolean, and a button `action` handler receives `{ tour, step }`.

## Selectors

`target` is a selector string, resolved when the step shows. `mountIn` and `dimMountIn` are selector strings that become functions throwing `TourEnvironmentError` with the JSON path when nothing matches at `start()`.

## Code-only keys

These keys, or these forms of a key, cannot be written as JSON. Set them on the config in code after parsing.

- `body` as an `Element`, a `DocumentFragment` or a function: JSON bodies are strings or lists of strings.
- `mountIn` as a function you wrote: `serializeTour` writes an `Element` through `elementSelectors`, and the function `parseTourJson` made back to its selector, but nothing else.
- `dimMountIn` as a function you wrote: the same rules as `mountIn`.
- `progress`: a progress store is code.
- `presenter`: a presenter factory is code.
- `sanitize`: a sanitizer is code.

## Values JSON cannot carry

- `Infinity` and `NaN` are not JSON. `waitBudget` and `hookTimeout` use `0` for no limit in the engine; write `0` or a large finite number. `serializeTour` throws for `Infinity`.
- `meta`, `extensions` and button `attrs` are handed over by reference: `parseTourJson` returns the same objects it was given, so changing the config changes the parsed document.
- `serializeTour` checks `meta` and `extensions` for plain JSON values and throws with the path for functions, dates, `NaN` and the like.
