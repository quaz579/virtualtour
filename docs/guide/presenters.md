# Presenters

The engine draws the popover frame: title, plain-text description, close button, arrow and the Next and Back buttons. A presenter draws everything else a step needs: rich bodies, custom footer buttons and any decoration. The default presenter draws the dialog. You can replace it per tour with `presenter`, or use the speech-bubble layout from `virtualtour/avatar` (see [Avatar](../avatar/)).

A presenter is created once per run, when the first step of the run needs it, and released when the run ends. The tour's `presenter` option is a factory, so each run gets a fresh instance.

## The Presenter interface

| Member | When it runs |
|---|---|
| `mount(popover, step, parts)` | After the popover content is applied and before it is positioned. Build your parts here. |
| `afterShow(popover, step)` | The step is on screen. The default presenter moves focus to the first enabled button when the step sets `focus: 'first-button'`. |
| `afterReposition(popover, step, info)` | Each time the popover is positioned: on show, on resize and scroll, and on `refresh()`. `info` is a `RepositionInfo`. |
| `update(popover, step, parts)` | The step's configuration changed while it is on screen (`step.configure()`). Re-apply the step. |
| `beforeLeave(step)` | The step is about to hide. |
| `onNudge(step)` (optional) | The popover shook: Next, ArrowRight or the overlay pressed on an unmet action step, a rejected gesture, or `tour.nudge()`. Runs for plain steps too. |
| `onCompleted(step)` (optional) | An action step's instruction was met. Runs before the `completed` event. |
| `unmount()` | The run ended. Release everything. |
| `layout` (optional) | `'dialog'` (default) or `'speaker'`. See below. |
| `ready()` (optional) | See below. |

An error thrown from any hook is caught and logged with `console.error`. The tour keeps running.

`popover` is the engine's `PopoverDOM`: `wrapper`, `arrow`, `title`, `description`, `footer`, `closeButton`, `previousButton`, `nextButton` and a few more, plus `body`, `instruction` and `feedback` when they exist. `virtualtour` does not export the type by name. Take it from the interface: `Parameters<Presenter['mount']>[0]`.

`parts` is a `StepParts` object that lives for as long as the step is mounted:

| Member | Meaning |
|---|---|
| `content` | The element or fragment the step's `body` resolved to, when the body is not a string. Clone it into the popover. A string body is already in `popover.description`. |
| `body` | The element you put the body clone in. Set it so others can find it. |
| `footer` | Your footer element for custom buttons. |
| `buttons` | The custom button elements you drew. |

## The footer obligation

A step's `buttons` hide the engine's Next and Back buttons, and the engine does not draw the custom ones. The presenter has to. The default presenter does it with an internal helper that is not part of the public API, so a custom presenter draws its own footer and keeps `parts.buttons` and `parts.footer` in step with the step's `buttons`. Do it in both `mount` and `update`, because `step.configure({ buttons })` can change the list while the step is on screen.

A presenter that skips this leaves steps with `buttons` without any footer. The same goes for a non-string `body`: if you never clone `parts.content`, nothing shows.

Each button's `action` is `'forward'`, `'backward'`, `'exit'`, `'finish'` or a function that receives `{ tour, step }`. Call the matching tour method; `forward` and `exit` return promises. `text`, `label` and `disabled` can be functions, so evaluate them each time you draw.

## A custom presenter

This presenter draws a card with its own footer. It keeps the dialog layout, clones a rich body, and records the side the popover ended up on.

<<< @/snippets/guide/presenter-custom.ts

The factory receives the tour and a `PresenterContext`.

## PresenterContext

| Field | Meaning |
|---|---|
| `namespace` | The tour's `namespace` (default `vt`). Use it for your own data attributes so two tours with different namespaces stay apart. |
| `sanitize` | The tour's `sanitize` hook, when set. Run any HTML string you put on the page through it. |
| `fadeMs` | How long the engine's entrance fade lasts: `dim.transitionMs`, or `0` when `animate` is off. Start your own entrance work after it. |

## ready()

`ready()` returns a promise. The tour awaits it once, before it builds the first step of a run, so a presenter can finish loading something and choose its `layout`. The engine reads `layout` after the promise settles.

- A rejection or a thrown error is logged with `console.warn` and the run goes on.
- The tour stops waiting after 10 seconds, logs a warning and shows the first step with whatever the presenter has by then.
- If the run ends while `ready()` is pending, nothing is shown and no warning is logged.

`ready()` runs whenever the tour has no popover to reuse: at the first step, and again if you call `hideCurrent()` and then `goTo()` in the same run.

## RepositionInfo

`afterReposition` receives where the popover ended up.

| Field | Meaning |
|---|---|
| `side` | `'top'`, `'bottom'`, `'left'`, `'right'`, or `'over'` for a centered step. This is the side that was used, after any flip. |
| `align` | `'start'`, `'center'` or `'end'`: the logical alignment. |
| `physicalAlign` | The alignment as a physical edge: `left` or `right` for top and bottom sides, `top` or `bottom` for left and right sides, `center` otherwise. In right-to-left layouts the horizontal edges swap. |
| `rtl` | Whether the anchor is laid out right to left. |
| `pinned` | No side fit, so the popover is pinned to the bottom center of the viewport and its arrow is hidden. `side` still names the requested side; treat a pinned popover as `over`. |
| `wrapperRect` | The popover wrapper's rectangle. |
| `bubbleRect` | The visible bubble. Equal to `wrapperRect` in the dialog layout. |
| `targetRect` | The target's rectangle, or `null` when the step has no real target. |

## The speaker layout

Set `layout = 'speaker'` on a presenter and the engine builds a different frame. The wrapper gets the classes `vt-popover` and `vt-speaker`. Inside it are the arrow (class `vt-bubble-tail`), a `vt-bubble` holding the close button, title, description and footer, and an empty `vt-avatar-slot` after it. The wrapper starts with `data-vt-dock="end"`.

The layout only creates the elements. Styling lives in `virtualtour/avatar.css`, and moving something into the slot is up to the presenter. `SpeakerPresenter` and `withAvatar` from `virtualtour/avatar` do both; see the [avatar reference](../avatar/). With `bubbleRect` and `wrapperRect` in `RepositionInfo`, a presenter can tell where the bubble sits inside the wrapper.

## Related

- [Action steps](./action-steps) covers `onNudge` and `onCompleted`.
- [Positioning](./positioning) covers the placement that `RepositionInfo` reports.
