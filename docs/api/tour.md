# Tour reference

`createTour(config)` returns a `Tour`. This page lists its members, its events with payloads, the `tours` registry and the other helpers `virtualtour` exports. `createTour` is also the default export. It is safe to call on the server; `start()` needs a browser and rejects with `TourEnvironmentError` without a document.

<<< @/snippets/api/tour-instance.ts

## Tour

| Member | Meaning |
|---|---|
| `id` | The tour id. |
| `name` | The `name` option, when set. |
| `steps` | `readonly TourStep[]`, in order. Created eagerly, so no DOM is needed. |
| `currentStep` | The step on screen, or `null`. |
| `isRunning()` | Whether a run is active. Stays `true` while the popover is hidden with `hideCurrent()`. |
| `progressInfo()` | `{ index, total }`. `index` is 1-based and `0` when no step is on screen. `total` counts skipped steps. |
| `stepById(id)` | The step or `undefined`. |
| `appendStep(def, at?)` | Adds a step at the end, at a zero-based index, or before the step with the given id. Returns the `TourStep`. Throws `TourNavigationError` for a bad index, an unknown id or a duplicate id. |
| `dropStep(ref)` | Removes a step by id or instance. An unknown reference does nothing. While running, a shown step is disposed at once and the tour moves to the step that now follows it, or exits without a prompt when none does. |
| `start()` | Starts at the first step and resolves once it is shown. Does nothing when a run is active. Any other running tour exits with reason `replaced`. With `progress` it first loads the record; a finished tour emits `bypassed` instead of starting, and `resume` starts at the saved step. |
| `forward()` | Next step, or finish after the last. On an unmet action step it nudges instead of moving, whoever calls it. No effect when no run is active. |
| `backward()` | Previous step. Does nothing on the first step; exits when no earlier step is eligible. |
| `goTo(ref?)` | Shows a step by index, id or `TourStep`. Without an argument it shows the current step again, or the first. Starts the tour when none is running. Rejects with `TourNavigationError` for an unknown reference. Not gated by action steps. |
| `advance()` | Returns `void`. Completes the action step on screen as if the user did what it asks: emits `completed`, then `step-completed`, waits `advanceDelay`, moves forward. On a plain step it only moves forward with no events. No effect when no step is on screen or the step waits for its target. |
| `nudge(message?)` | Shakes the popover and calls the presenter's `onNudge`. `message` is HTML passed through `sanitize`; without one the feedback row is cleared. No effect when no step is on screen. |
| `exit()` | Ends the run as cancelled with reason `api`, after `exitPrompt`. Resolves `false` when the prompt declined, `true` otherwise, including when no run is active. |
| `finish()` | Ends the run as completed. No effect when no run is active. |
| `hideCurrent()` | Removes the popover while the run stays active. The next navigation shows a step again. |
| `refresh()` | Repositions the popover. No effect when no run is active. |
| `on(event, fn, ctx?)` | Subscribes and returns an unsubscribe function. `ctx` becomes `this`. |
| `once(event, fn, ctx?)` | Like `on`, removed before its first call. |
| `off(event?, fn?)` | Removes every handler, every handler of one event, or one handler of one event. |

## Events

Handlers run in registration order. A throwing handler is logged and the rest still run. Tour listeners run before the registry's.

| Event | Payload | When |
|---|---|---|
| `started` | `{ tour }` | A run begins. |
| `activated` | `{ tour }` | Right after `started`. |
| `step-shown` | `{ tour, step, previous }` | A step is on screen. `previous` is the step shown before it in this run, or `null`. |
| `step-completed` | `{ tour, step }` | An action step's instruction was met. |
| `finished` | `{ tour }` | The tour completed. |
| `exited` | `{ tour, reason }` | The tour was cancelled. `reason` is `close`, `escape`, `overlay`, `api` or `replaced`. |
| `bypassed` | `{ tour, reason: "completed" }` | `start()` skipped the tour because saved progress says it was finished. No `started` follows. |
| `deactivated` | `{ tour }` | The run is over and `tours.current` is cleared. The last event of a run. |

Order inside a run: `started`, `activated`, then for each step the step events `will-show`, `shown`, then `step-shown`. On the way out: `will-hide` and `hidden` for the step, the step's `finished` or `exited`, the tour's `finished` or `exited`, step `disposed` events, and `deactivated`. A tour that is ending can restart in a `deactivated` handler.

Reasons: `close` is the close button, `escape` is the Escape key, `overlay` is a click on the dimmed area with `clickOutside: "exit"`, `api` is `exit()`, `step.exit()`, `dropStep` of the last remaining step and unmounting a framework wrapper, `replaced` is another tour starting. Progress records an exit as `exitedAt` for every reason except `replaced`.

<<< @/snippets/api/tour-events.ts

## The registry

`tours` tracks the one active tour and relays every tour event.

| Member | Meaning |
|---|---|
| `tours.current` | The running `Tour`, or `null`. |
| `tours.on(event, fn, ctx?)` | Subscribes to an event of any tour. Returns an unsubscribe function. |
| `tours.once(event, fn, ctx?)` | Like `on`, removed before its first call. |
| `tours.off(event?, fn?)` | Removes handlers as `Tour.off` does. |

Only one tour is active at a time. Starting a second ends the first with `exited` and reason `replaced`. See [Multiple tours](../cookbook/multiple-tours).

## Exported helpers

| Export | Meaning |
|---|---|
| `createTour(config?)` | Builds a `Tour`. Also the default export. |
| `Tour`, `TourStep` | The classes. `TourStep` is never constructed by callers. |
| `tours` | The registry above. |
| `Emitter<Events>` | The typed emitter the tour is built on: `on`, `once`, `off`. Useful for your own event bus. |
| `localStorageStore(prefix?)` | A `ProgressStore` in `window.localStorage` under `<prefix>:<tourId>`, default prefix `virtualtour`. A `prefix` containing `:` throws. Unavailable or full storage never throws: `load` returns `null`, `save` and `clear` do nothing. Storage is read only when a method runs. |
| `memoryStore()` | A `ProgressStore` that lives as long as the page. Records are copied in and out. |
| `parseTourJson(json, options?)` | Turns a `virtualtour-tour/1` document, as text or a parsed value, into a `TourConfig`. `options.handlers` resolves `{ "handler": name }` references. Throws `TourJsonError` with a `path` for anything invalid. See [JSON tours](../guide/json-tours). |
| `serializeTour(config, options?)` | Writes a config as a document. Every function needs a name in `options.handlerNames` and every element a selector in `options.elementSelectors`. Throws `TourJsonError` for `progress`, `presenter`, `sanitize` and element or function bodies. |
| `TourJsonError` | Carries `path`, for example `steps[2].buttons[0].action.handler`. |
| `TourEnvironmentError` | Thrown when a browser is needed and missing, or a required page element is missing. |
| `TourNavigationError` | Thrown for an unknown step reference, a bad index or a duplicate step id. |

Types exported from the package include `TourConfig`, `StepConfig`, `DimConfig`, `ProgressConfig`, `ProgressStore`, `ProgressRecord`, `Presenter`, `PresenterContext`, `PresenterFactory`, `RepositionInfo`, `ExitReason`, `TourEvents`, `StepEvents` and the JSON document types.

<<< @/snippets/api/helpers.ts

Two more entry points ship separately: `virtualtour/motion` (`glide`, `progressVars`; see [Custom counter](../cookbook/custom-counter)) and `virtualtour/avatar`.
