# Accessibility

Placeholder: the full guide arrives with the docs work. This page records what the dialog mode guarantees, how it is tested, and the manual screen reader script.

## What the dialog mode does

| Area | Behavior |
|---|---|
| Role and name | The popover is `role="dialog"`. A title names it through `aria-labelledby`. A step without a title uses its `label` as `aria-label`. A step with neither has no accessible name, and development builds log one warning per tour. |
| Description | `aria-describedby` points at the description for a string body, at `.vt-body` for an Element body, and also at the instruction text on an action step. |
| Buttons | The close button carries an `aria-label` (set `closeButton.label` to change it). Footer and custom buttons are native `<button>` elements named by their text or `label`. A gated Next button is `aria-disabled` and stays focusable. |
| Focus | Focus moves into the popover when a step shows. Tab cycles through the close button, the footer buttons, the custom buttons, the target and its extras. When the tour ends, focus returns to the element that had it when the tour started. |
| Keyboard | Escape exits and the arrow keys move between steps. Both are ignored while focus is in an input or widget on the page, and `keys.escape: false` or `keys.arrows: false` turns them off. |
| Reduced motion | With `prefers-reduced-motion: reduce` the tour runs in `vt-simple` mode: no fade, no tween, and the nudge flashes instead of shaking. |
| Live region | A polite live region announces step text when it changes through `configure()` and when an action step gives feedback. |
| Target attributes | A button, a link, a `select`, a `summary`, a button-type `input` or an element with an interactive role (button, link, menu item, tab, combobox, switch, checkbox or tree item) gets `aria-haspopup`, `aria-expanded` and `aria-controls` while it is the target. Other elements are left alone because those attributes are invalid on them. |
| Zoom | In a 640x400 viewport (a 1280x800 window at 200% zoom) the popover stays inside the viewport and every control stays operable. |

## Automated checks

`test/a11y.test.ts` covers the name and description attribute matrix, named controls, focus return, keyboard and the live region. `e2e/a11y.spec.ts` runs the axe-core engine against a titled step, an untitled labeled step, a centered step, a spotlit step, an action step and a step with custom buttons in Chromium, Firefox and WebKit (and Edge where installed), and completes a four-step tour with the keyboard alone.

## Manual screen reader script

Run this once per milestone on VoiceOver (macOS, Safari) or NVDA (Windows, Firefox), with the four-step demo tour.

1. Turn the screen reader on and focus the Start button. Press Enter.
2. Expect the dialog name and the first step text to be read, for example "First, dialog" followed by the description.
3. Press Tab. Expect the close button to be announced by its label, then each footer button by its text.
4. Press Enter on Next. Expect the new dialog name and text to be read, and focus to stay inside the popover.
5. Press Escape. Expect the tour to close and focus to land on the Start button.
6. Start again and walk to the last step. Expect the button to read "Done".
7. On an action step, expect the instruction text to be read after the description. Complete the action and expect the feedback text to be announced.

Record the screen reader, browser, version and the result of each step in the pull request.
