# Advancing a tour from page code

Stub. This recipe grows with the action-step work.

## Move the tour from your own button

`tours.current` is the running tour, or `null`. Call `forward()` from any handler:

```ts
import { tours } from "virtualtour";

saveButton.addEventListener("click", () => {
  void tours.current?.forward();
});
```

## Advance when the user does the thing

Set `autoAdvance` on the step. With a `selector`, a capture-phase listener on the document calls `forward()` once for a matching event, even when the page stops propagation. Without a `selector`, the engine advances on the event at the step's target.

```ts
{ target: "#save", autoAdvance: { event: "click", selector: "#save" } }
{ target: "#name", autoAdvance: { event: "input" } }
```

## Open a panel before the step that points into it

A step's target is looked up before its `prepare` runs, so a `prepare` that creates the target comes too late: the step shows centered. Open the panel in the step before, or let the step wait with `waitFor`.

```ts
{ id: "open", title: "Open the panel", prepare: openPanel }
{ id: "panel", title: "The panel", target: "#panel-button" }
```
