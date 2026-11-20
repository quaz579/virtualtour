# Events and lifecycle

A tour reports what it is doing through events on the tour, on each step, and on the shared `tours` registry. This page lists every event with its payload, the exact order they fire in, and why a tour ends.

## Subscribe

`on`, `once` and `off` exist on a tour, on a step, and on `tours`.

| Call | Meaning |
|---|---|
| `on(event, fn, ctx?)` | Subscribes. Returns a function that removes this subscription. `ctx` becomes `this` inside `fn`. |
| `once(event, fn, ctx?)` | Like `on`, but removed before its first call. |
| `off(event?, fn?)` | No arguments removes every handler. With an event, removes that event's handlers. With both, removes that handler for that event. |

Handlers run synchronously in the order they were added. A handler that throws is reported with `console.error` and the rest still run, so a broken analytics hook cannot stop a tour.

`tours` is the registry. It relays every tour event, after the tour's own handlers ran, and `tours.current` is the one active tour or `null`. Only one tour runs at a time.

<<< @/snippets/guide/events-listen.ts

## Tour events

Payloads always include `tour`.

| Event | Payload | When |
|---|---|---|
| `started` | `{ tour }` | A run begins. Fires before the first step shows. |
| `activated` | `{ tour }` | Right after `started`. |
| `step-shown` | `{ tour, step, previous }` | A step is on screen. `previous` is the step that was hidden just before it, or `null` for the first show of a run. |
| `step-completed` | `{ tour, step }` | The user met an [action step](./action-steps)'s instruction. Only fires for steps that have an `instruction`. |
| `finished` | `{ tour }` | The tour completed. |
| `exited` | `{ tour, reason }` | The tour ended without finishing. See [Exit reasons](#exit-reasons). |
| `bypassed` | `{ tour, reason: "completed" }` | `start()` found saved progress that says the user already finished and did not run. Fires instead of `started`. See [Persistence](./persistence). |
| `deactivated` | `{ tour }` | The last event of every run, after finish, exit or replacement. |

The run counts as active until just before `deactivated`, so call `start()` again from a `deactivated` handler if you want a restart.

## Step events

Payloads are `{ step }`. Subscribe with `step.on(...)`.

| Event | When |
|---|---|
| `will-show` | The tour is about to show the step. |
| `shown` | The popover is in the DOM and the presenter has mounted. |
| `will-hide` | The step is about to leave the screen. |
| `hidden` | The step left the screen. Always follows `will-hide` directly. |
| `completed` | An action step's instruction was met. Only fires for steps with an `instruction`. |
| `finished` | The run finished while this step was current. |
| `exited` | The run ended with this step as the last one shown, or as the step being left by a move that had not finished. A move's target gets `exited` only when its show had begun and no earlier step was shown on the same engine, such as the first show of a run or a move after `hideCurrent()`. If no step had begun to show, no step gets `exited`. |
| `disposed` | The run is over and the step released its element and target. Fires exactly once per step per run. |

## Order of events

This table is checked by the test suite. Each row lists the events in the order they fire. The step names `S` and `T` are the old and new steps.

| Situation | Events, in order |
|---|---|
| `start()` | `tours.current` is set, tour `started`, tour `activated`, then "show a step" |
| Show a step `S` | S `will-show`, presenter mounts, S `shown`, tour `step-shown` (with `previous`), then the navigation promise resolves |
| Move from `S` to `T` | S `will-hide`, S `hidden`, T `will-show`, T `shown`, tour `step-shown` |
| `exit()` while a move from `S` to `T` has not shown `T` | If the move had started, S `will-hide`, S `hidden` and T `will-show` have already fired. `exit()` then fires S `will-hide` and S `hidden` only if S is still on screen, S `exited`, tour `exited` (with `reason`), every step `disposed`, `tours.current` cleared, tour `deactivated` |
| `dropStep(T)` after the move to `T` began (T `will-show` fired) | T `disposed` with no `shown`, then the first remaining step after `T` shows, whichever way the move went, and no earlier step shows first. With none left, the tour exits with reason `api`: S `exited`, tour `exited`, never `finished` |
| `dropStep(T)` while the move to `T` is still in `prepare`, `revealWith` or a wait | T `disposed` only, and the move skips it. If no step is left to show, the tour exits with reason `api`, never `finished` |
| `S` shown again later | S `will-show`, S `shown`. No `disposed` in between |
| Action step `S` completed | S `completed`, tour `step-completed`. After the step's `advanceDelay`, the move to the next step starts as above |
| `hideCurrent()` | S `will-hide`, S `hidden`. No `exited`. The tour stays running |
| `dropStep(S)` while `S` is on screen | S `will-hide`, S `hidden`, S `disposed`, then the next remaining step shows. With none left, the tour exits with reason `api`, no prompt |
| `finish()`, Done on the last step, or forward past the last step | S `will-hide`, S `hidden`, S `finished`, tour `finished`, every step `disposed` in array order, `tours.current` cleared, tour `deactivated` |
| `exit()`, accepted or no prompt | S `will-hide`, S `hidden`, S `exited`, tour `exited` (with `reason`), every step `disposed`, `tours.current` cleared, tour `deactivated` |
| Escape, close button, or overlay click with `clickOutside: "exit"` | The exit prompt runs. Accepted: same as `exit()`. Declined: nothing fires |
| `exit()` with the prompt declined | Nothing fires. The promise resolves `false` |
| Every remaining step skipped, moving forward | Same as `finish()` |
| Every earlier step skipped, moving backward | Same as `exit()` with no prompt, reason `api` |
| Backward on the first step | Nothing. The promise resolves |
| Another tour starts while this one runs | This tour's `exit` sequence with reason `replaced` and no prompt, then the new tour's `started` |
| `configure()` on a shown step | Nothing fires. The popover updates in place |

The registry relay of an event comes right after the tour's own handlers for it.

## Exit reasons

`exited.reason` is one of these.

| Reason | Cause |
|---|---|
| `close` | The user pressed the close button. |
| `escape` | The user pressed Escape. |
| `overlay` | The user clicked the dimmed area with `dim.clickOutside: "exit"`. |
| `api` | Your code called `exit()`, the last step was dropped (on screen or as the target of a move), every earlier step was skipped when going back, or a navigation failed. |
| `replaced` | Another tour started. |

`close`, `escape` and `overlay` go through the `exitPrompt` option first. A string prompt uses `window.confirm`. A function may return a boolean or a promise. If the function throws, the error is logged and the tour stays open. `exit()` from code goes through the prompt too, and resolves `false` when the user declines. `replaced` and the automatic exits never prompt.

<<< @/snippets/guide/events-exit-reasons.ts

## Navigation and promises

Moves are serialized. One move runs at a time and at most one waits behind it. A newer request replaces the waiting one without running it, and the replaced caller's promise resolves when the move that actually happened settles. `exit()` and `finish()` cancel any move that is waiting for a target or a hook.

`start()` resolves once the first step is shown, or at once when a run is already active. `forward()`, `backward()` and `goTo()` resolve once the new step is shown. With saved progress, `start()` first waits for the store, see [Persistence](./persistence).

## Time limits during a move

A move can wait on your page in three places. Each has a bound so a stuck page cannot freeze the tour.

| Wait | Bound | Default | On timeout |
|---|---|---|---|
| Target to appear (`waitFor`) | the step's `waitFor`, capped by the tour's `waitBudget` across the move | `waitBudget` 10000 ms | The step follows `whenMissing`. |
| Progress store `load` | the tour's `waitBudget` | 10000 ms | A warning is logged and the tour starts without saved progress. |
| `prepare` and `revealWith` | the step's `hookTimeout`, per hook | 10000 ms | A warning is logged and the step shows anyway. |
| `presenter.ready()` | fixed, not configurable | 10000 ms | A warning is logged and the step shows with what the presenter has. |

`0` or `Infinity` for `hookTimeout` or `waitBudget` removes the bound. Details are in [Steps and targets](./steps-and-targets#time-limits).

<<< @/snippets/guide/events-timeouts.ts

Next: [Action steps](./action-steps).
