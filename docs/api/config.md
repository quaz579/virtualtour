# Config reference

`createTour(config)` takes a `TourConfig`. Every key is optional. This page lists every key, its type, its default and what it does. Step keys are in the [Step reference](./step), instance methods and events are in the [Tour reference](./tour).

<<< @/snippets/api/config-full.ts

## TourConfig

| Key | Type | Default | Meaning |
|---|---|---|---|
| `id` | `string` | `<name-slug>-<random>` | Identifies the tour for saved progress. The default changes on every page load, so set a stable one when you use `progress`. A dev build warns when `progress` is set without `id`. |
| `name` | `string` | none | Human label, readable as `tour.name`. Also the base of the default `id`. |
| `steps` | `StepConfig[]` | `[]` | Steps in order. A step without an `id` gets `step-1`, `step-2` and so on. A duplicate `id` throws `TourNavigationError`. |
| `stepDefaults` | `Partial<StepConfig>` | none | Merged under every step. `position`, `spotlight`, `closeButton` and `extensions` merge key by key. Arrays, functions, elements and every other key are replaced. |
| `dim` | `boolean \| DimConfig` | `false` | `false` draws no overlay. `true` draws it with the defaults below. An object draws it with those options. |
| `mountIn` | `Element \| () => Element` | `document.body` | Where the popover goes. Must be an element of the current document, outside any shadow root. A step whose target is inside an open `<dialog>` mounts in that dialog and ignores it. See [Containers](../guide/containers). |
| `dimMountIn` | `Element \| () => Element` | `document.body` | Where the overlay goes. Same rules as `mountIn`. The overlay stays `position: fixed`. |
| `namespace` | `string` | `"vt"` | Prefix for the classes and the `data-<ns>-step` and `data-<ns>-side` attributes the tour adds. Letters, digits, `_` and `-`, starting with a letter. Anything else throws `TypeError`. The fixed `data-vt-*` mechanism attributes do not change. |
| `keys` | `{ escape?: boolean; arrows?: boolean }` | `{ escape: true, arrows: true }` | Escape exits the tour. The arrow keys move between steps. |
| `exitPrompt` | `false \| string \| () => boolean \| Promise<boolean>` | `false` | Asked before an exit from the close button, Escape, the overlay or `exit()`. A string uses `window.confirm` and answers at once. A function is awaited; `false` keeps the tour open. A function that throws is logged and keeps the tour open. |
| `counter` | `boolean \| (index, total) => string` | `false` | `true` shows "1 of 3". A function receives the 1-based index and the step count, skipped steps included, and returns the text. |
| `labels` | `{ next?, back?, done?, close? }` | `Next`, `Back`, `Done`, `Close` | Button text. `close` is the close button's accessible name. A label that contains `<` goes through `sanitize`. |
| `progress` | `ProgressConfig` | none | Saves and restores where the user got to. See [ProgressConfig](#progressconfig). Code only: JSON tours cannot carry it. |
| `presenter` | `(tour, context) => Presenter` | built-in dialog presenter | Replaces the presenter that draws the parts of a step the engine does not. Code only. See [Presenters](../guide/presenters). |
| `sanitize` | `(html: string) => string` | none | Cleans title, body, instruction, nudge message, counter and button text before it reaches the page. Code only. See [Sanitizing HTML](../cookbook/sanitizing-html). |
| `animate` | `boolean` | `true` | `false` turns off the popover and overlay animations. Reduced-motion users get no animation either way. |
| `waitBudget` | `number` (ms) | `10000` | Total time one navigation may spend waiting for targets across consecutive steps that set `waitFor`. The first step that waits always gets its full `waitFor`. After the budget is spent, later steps are judged on what is on the page and follow their `whenMissing`, with a logged warning. `0` or `Infinity` removes the cap. |

## DimConfig

Used by `dim` when it is an object. When `dim` is `false` the values below still apply to the spotlight fallbacks, but no overlay is drawn.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `padding` | `number` | `10` | Space between the target and the cut-out edge. A step's `spotlight.padding` overrides it. |
| `radius` | `number \| CornerRadius` | `5` | Cut-out corner radius. `CornerRadius` is `{ topLeft?, topRight?, bottomRight?, bottomLeft? }`; an unset corner keeps the default. |
| `transitionMs` | `number` | `400` | Duration of the cut-out move between steps. Also the entrance fade passed to presenters as `fadeMs`. |
| `color` | `string` | `#000` | Overlay color. |
| `opacity` | `number` | `0.7` | Overlay opacity, 0 to 1. |
| `clickOutside` | `"none" \| "exit" \| "forward"` | `"none"` | What a click on the dimmed area does. `none` swallows the click. |
| `pageScroll` | `boolean` | `true` | `false` sets `overflow: hidden` on `<body>` while a step is shown. Scrolling is on by default. See [Scroll lock](../cookbook/scroll-lock). |
| `lockScrollParent` | `boolean` | `false` | `true` freezes the target's direct parent while a step is shown, when that parent scrolls. |
| `clipToScrollParents` | `boolean` | `true` | Cuts out only the part of the target that its scrolling ancestors leave visible. |

## ProgressConfig

| Key | Type | Default | Meaning |
|---|---|---|---|
| `store` | `ProgressStore` | required | Where records are kept. |
| `skipCompleted` | `boolean` | `true` | `start()` does nothing but emit `bypassed` when the saved record says the tour was finished. |
| `resume` | `boolean` | `false` | `start()` begins at the last step shown, when the saved step id still exists. |

Steps need stable ids for `resume` to find them. The engine saves when a step is shown (`lastStepId`), when the tour finishes (`completedAt`) and when it exits (`exitedAt`, except for reason `replaced`). Saves are not awaited: the tour moves on at once. A store that throws or rejects is reported with a dev-build warning and otherwise ignored. A failed `load` starts the tour without saved progress.

`ProgressStore` has three members. Each may return a value or a promise.

| Member | Meaning |
|---|---|
| `load(tourId)` | Returns the `ProgressRecord` or `null`. |
| `save(record)` | Stores the record. |
| `clear(tourId)` | Removes it. |

`ProgressRecord` is `{ tourId, lastStepId?, completedAt?, exitedAt?, updatedAt }`, the dates as ISO strings. `localStorageStore(prefix?)` and `memoryStore()` are the two built-in stores; see [Tour reference](./tour#exported-helpers).

## Presenter types

| Type | Shape |
|---|---|
| `PresenterFactory` | `(tour: Tour, context: PresenterContext) => Presenter`. Called once per tour run. |
| `PresenterContext` | `{ namespace: string; sanitize?: (html) => string; fadeMs: number }`. `sanitize` is the tour's hook, already memoized. `fadeMs` is `dim.transitionMs`, or `0` when `animate` is off. |
| `Presenter` | `mount`, `afterShow`, `afterReposition`, `update`, `beforeLeave` and `unmount` are required. `onNudge`, `onCompleted`, `layout` (`"dialog"` or `"speaker"`) and `ready` are optional. `ready()` is awaited once before the first step is built; a rejection is ignored and the wait stops after 10 seconds. |

See [Presenters](../guide/presenters) for writing one.
