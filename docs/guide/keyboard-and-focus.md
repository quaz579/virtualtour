# Keyboard and focus

A running tour handles a few keys, keeps Tab inside the tour, and moves focus into the popover for each step. This page lists the keys, when the tour ignores them, and where focus goes.

## Keys

| Key | Action |
|---|---|
| ArrowRight | Next step. On the last step it finishes the tour. |
| ArrowLeft | Previous step. Does nothing on the first step or while the tour is waiting for a target. |
| Escape | Closes the tour with reason `escape`, through the `exitPrompt` when there is one. |
| Tab and Shift+Tab | Cycle focus. See [Focus trap](#focus-trap). |

Keys act when the key is released, not when it goes down.

Two switches turn the keys off. Both default to `true`.

| Option | Turns off |
|---|---|
| `keys.escape: false` | Escape. The close button still works. |
| `keys.arrows: false` | ArrowLeft and ArrowRight. The buttons still work. |

<<< @/snippets/guide/keyboard-keys.ts

Hiding the close button with `closeButton: false` does not disable Escape. Use `keys.escape: false` for that.

While an [action step](./action-steps) is waiting for the user, ArrowRight nudges the popover instead of moving on. ArrowLeft and Escape still work.

When a step sets `buttons`, the default Back and Next buttons are hidden, and the arrow keys follow your buttons: ArrowRight works only if a button has the `forward` action, and ArrowLeft only if one has `backward`. Escape is not affected by `buttons`.

### When the tour ignores a key

The tour leaves a key alone when your page already used it.

- The page called `preventDefault()` on the key's `keydown`.
- Focus is in a text-entry or list widget inside the target or an extra: `input`, `textarea`, `select`, a content-editable element, or an element with the role `combobox`, `grid`, `listbox`, `menu`, `menubar`, `radiogroup`, `slider`, `spinbutton`, `tablist`, `textbox`, `tree` or `treegrid`.
- The key was already held down when the step changed, so a held arrow cannot skip through several steps.

Focus in a widget elsewhere on the page does not count. With `dim` on, the overlay blocks clicks there, but with `dim: false` a visitor can focus an outside field, and the arrow keys will still move the tour.

## Focus trap

While a tour runs, Tab and Shift+Tab cycle through the focusable elements in the popover, then the target, then any `spotlight.extra` elements. Focus wraps at both ends and cannot leave that set by keyboard. The trap is active with `dim: false` too.

## Where focus goes

| Moment | Focus |
|---|---|
| A step shows | The Next button when it can take focus, otherwise the popover itself, which is a dialog with `tabindex="-1"`. |
| A step shows and focus is already inside the target or an extra | Stays where it is, so a user typing in a highlighted field is not interrupted. A target with `targetInteractive: false` does not count. |
| `focus: "first-button"` on a step | The first enabled custom button, once the step is shown. Does nothing for a step without `buttons`. |
| A focused popover button becomes disabled | The popover takes focus, and the button gets it back when it is enabled again. |
| The tour ends | The element that had focus when the tour started. |

`focus: "dialog"` is the default and means the first row.

A gated Next button on an action step stays focusable. It is marked `aria-disabled` rather than `disabled`, so a screen reader user can still reach it and hear that it is not available yet.

<<< @/snippets/guide/keyboard-focus.ts

See [Accessibility](./accessibility) for roles, names and the live region.
