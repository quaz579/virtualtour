# Advancing a tour from page code

A tour can move on because the user pressed Next, because the user did something on the page, or because your code said so. This page covers the last two. For steps that wait for the user, see the [action steps guide](../guide/action-steps).

## Move the tour from your own button

`tours.current` is the running tour, or `null`. Call `forward()` from any handler. It resolves when the move is done. On an action step whose instruction is not met it nudges instead of moving.

<<< @/snippets/cookbook/advance-button.ts

## Advance when the user does the thing

Set `autoAdvance` on the step. With a `selector`, a listener on the document calls `forward()` once for a matching event, after the page's own handlers ran. Without a `selector`, the engine advances on the event at the step's target.

<<< @/snippets/cookbook/auto-advance.ts

## Complete an action step yourself

On a step with an `instruction`, `tour.advance()` counts as the user having done the thing. It emits `completed` and `step-completed`, waits the step's `advanceDelay`, then moves forward. It returns nothing. On a plain step it only moves forward and emits no events. It does nothing when no step is on screen or the step still waits for its target.

<<< @/snippets/cookbook/complete-action-step.ts

During `advanceDelay` the engine's own Next button does nothing, while `tour.forward()` moves on at once.

## Open a panel before the step that points into it

A step's target is looked up before its `prepare` runs, so a `prepare` that creates the target comes too late: the step shows centered. Open the panel in the step before, or let the step wait with `waitFor`.

<<< @/snippets/cookbook/prepare-panel.ts

<<< @/snippets/cookbook/wait-for-target.ts

`waitFor` is capped by the tour's `waitBudget`, 10 seconds across consecutive waiting steps by default. See the [Config reference](../api/config).

## Hooks that never settle

`prepare` and `revealWith` each get `hookTimeout` milliseconds, 10 seconds by default. When one runs longer the tour logs a warning and shows the step anyway, as it does when the hook throws. `0` or `Infinity` waits forever.

<<< @/snippets/cookbook/hook-timeout.ts
