# Action steps

Stub: the full guide arrives with the docs work. This page lists every public member of the action-step API.

An action step asks the user to do something before the tour moves on. Give a step an `instruction` and it becomes gated: Next looks disabled and nudges when pressed until the step completes.

```ts
import { createTour } from "virtualtour";

const tour = createTour({
  steps: [
    {
      id: "save",
      target: "#save",
      title: "Save your work",
      instruction: "Click <b>Save</b>.",
      advanceDelay: 600,
      autoAdvance: { event: "click", strict: true },
    },
    { id: "done", title: "Saved" },
  ],
});
```

## Step options

| Member | What it does |
|---|---|
| `StepConfig.instruction` | Text of the instruction row, as HTML that passes through `sanitize` where the row is drawn. A function runs each time the step shows. An empty string means the step is not gated. A sanitizer that returns an empty string hides the row but keeps the gate. |
| `StepConfig.advanceDelay` | Milliseconds a completed step stays on screen in its done state before the tour moves on. Default 0. |
| `StepConfig.autoAdvance.strict` | With `autoAdvance` and no `selector`: block every other mouse gesture on the target and nudge. `{ event: "click", strict: true }` rejects a right-click. |

A selector `autoAdvance` on an action step completes the step the same way, so `advanceDelay` and the events below apply.

## Tour methods

| Member | What it does |
|---|---|
| `Tour.advance()` | Completes the action step on screen as if the user had done the thing. On a plain step it only moves forward and emits no events. No effect when no step is on screen or the step still waits for its target. |
| `Tour.nudge(message?)` | Shakes the popover (a flash under reduced motion). `message` goes in the feedback row as HTML that passes through `sanitize`; no message clears the row. |
| `Tour.forward()` | On an unmet action step it nudges instead of moving, whoever calls it: the engine's Next button, a custom `forward` button, the page. Once the step is complete, `forward()` moves on at once without waiting out `advanceDelay`. |

`goTo`, `backward` and `exit` are not gated. While the tour moves away from a completed step, repeated gestures and `advance()` calls emit no second event and move nothing twice. If the move never leaves the step, the next gesture completes it again.

## Events

| Member | When it fires |
|---|---|
| `StepEvents['completed']` | An action step's instruction was met, before any `advanceDelay`. |
| `TourEvents['step-completed']` | Right after `completed`. The registry relays it. |

Only steps with an `instruction` emit these. A plain step that moves on through `autoAdvance` does not.

## Presenter hooks

Both are optional members of `Presenter`.

| Member | When it runs |
|---|---|
| `Presenter.onNudge(step)` | The popover shook: Next, ArrowRight or the overlay pressed on an unmet step, a rejected gesture, or `Tour.nudge`. Runs for plain steps too. |
| `Presenter.onCompleted(step)` | The instruction was met. Runs before the `completed` event. |

During `advanceDelay` the engine's own Next button does nothing, while `Tour.forward()` moves on at once.

## Arrow keys with custom buttons

Custom `buttons` hide the engine's Next and Back. When a button has a `forward` or `backward` action, the arrow keys keep navigating anyway, through the same routes as the buttons: eligibility (`shouldShow`, `whenMissing`) applies, and an unmet action step nudges. `keys: { arrows: false }` turns them off. A step whose buttons only exit, finish or run a function keeps the arrows still. A step with only a `forward` or only a `backward` button gets both arrow directions.

## Engine hooks

The engine itself gains `Config.onStepCompleted` and `Config.onNudge`, plus `Driver.nudgeIfGated()` and the per-step `popover.navigateWithKeys`. The public layer wires them to the members above.
