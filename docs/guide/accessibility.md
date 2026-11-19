# Accessibility

This page records what the default dialog presenter does for accessibility, which of those claims automated tests cover, and the manual screen reader script. The manual pass has not been run yet. Until it has, treat the screen reader behavior below as intended, not confirmed.

## What the dialog mode does

| Area | Behavior |
|---|---|
| Role and name | The popover is `role="dialog"`. A title names it through `aria-labelledby`. A step without a title uses its `label` as `aria-label`. A step with neither has no accessible name, and development builds log one warning per tour. |
| Description | `aria-describedby` points at the description for a string body, at `.vt-body` for an Element body, and also at the instruction text on an action step. |
| Buttons | The close button carries an `aria-label` (set `closeButton.label` to change it). Footer and custom buttons are native `<button>` elements named by their text or `label`. A gated Next button is `aria-disabled` and stays focusable, so a keyboard user can press it and get the nudge. |
| Focus | Focus moves into the popover when a step shows. Tab cycles through the close button, the footer buttons, the custom buttons, the target and its extras. When the tour ends, focus returns to the element that had it when the tour started. |
| Keyboard | Escape exits and the arrow keys move between steps. Both are ignored while focus is in a text field, `select` or composite widget (listbox, slider, tablist and similar) inside the target or one of its extras, and `keys.escape: false` or `keys.arrows: false` turns them off. |
| Reduced motion | With `prefers-reduced-motion: reduce` the tour runs in `vt-simple` mode: no fade, no tween, and the nudge flashes instead of shaking. |
| Live region | A polite live region is mounted while a tour runs. It announces text that changes while a step is on screen: a new title or body after `configure()`, the feedback an action step gives, and the done text when a completed action step waits out an `advanceDelay`. It does not announce a step when it first shows. Exposing a newly shown step is left to the dialog role and the focus move. |
| Target attributes | A target that can plausibly open a popup gets `aria-haspopup="dialog"`, `aria-expanded="true"` and `aria-controls` while it is the target, and loses them when the step ends. That covers a button, a link with an `href`, a `select`, a `summary`, a `button`, `submit`, `reset` or `image` input, and an element whose `role` is `button`, `link`, `menuitem`, `menuitemcheckbox`, `tab`, `combobox`, `switch`, `checkbox` or `treeitem`. Other elements are left alone because those attributes are invalid on them. If the page already set any of the three attributes on the target, the tour leaves them as they are. |
| Zoom | In a 640x400 viewport (a 1280x800 window at 200% zoom) the popover stays inside the viewport and every control stays operable. |

## Automated checks

What the tests cover, and what they do not.

| Claim | Covered by |
|---|---|
| Dialog name and description matrix (title, label, string and element body, with and without an instruction) | `test/a11y.test.ts` |
| Close and footer buttons are named native buttons; a gated Next is `aria-disabled` and focusable | `test/a11y.test.ts` |
| Focus moves into the popover and returns to the trigger on exit; the first trigger stays the return target; Tab cycles close, buttons and target and Shift+Tab reverses | `test/a11y.test.ts`, and `e2e/a11y.spec.ts` in a browser |
| Escape and arrows, the `keys` switches, and keys typed in a field or widget on the page going to the app | `test/a11y.test.ts` and `e2e/a11y.spec.ts` |
| Live region: polite and atomic, mounted for the run and removed after, announces changed title and description after `configure()`, announces nothing when no text changed | `test/a11y.test.ts` and the engine tests; one browser check in `e2e/a11y.spec.ts` |
| Reduced motion switches to `vt-simple` and drops `data-vt-fade` | `test/a11y.test.ts` (with a stubbed media query) |
| No running animation after start and after Next under reduced motion; the nudge flash animation runs instead of the shake | `e2e/a11y.spec.ts` and `e2e/action-steps.spec.ts`, in a browser |
| No axe-core violations on a titled, an untitled labeled, a centered, a spotlit, an action and a custom-buttons step, in light and dark themes and with a dark system preference | `e2e/a11y.spec.ts` |
| A four-step tour completes with the keyboard alone | `e2e/a11y.spec.ts` |
| The popover stays inside a 640x400 viewport and stays operable | `e2e/a11y.spec.ts` (a viewport check, not a zoom check) |

The browser tests run in Chromium, Firefox and WebKit, and in Edge where installed.

### Not covered

- The `aria-haspopup` allow-list is tested for a button, a link, a role of button written in any case, a select, a submit input and a summary, and for a text input and a paragraph as non-targets. The roles `menuitem`, `menuitemcheckbox`, `tab`, `combobox`, `switch`, `checkbox` and `treeitem` are in the allow-list in the code but have no test of their own.
- Focus return when steps are added or dropped while the tour runs (`appendStep`, `dropStep`), and when the engine rebuilds its steps with `setSteps`, has no accessibility test. Focus after a `configure()` call that removes the button holding focus is not tested either. Only the live region text is tested for `configure()`.
- Real screen reader output. See the script below.

## Manual screen reader script

This pass is unrun. Run it once per milestone on VoiceOver (macOS, Safari) or NVDA (Windows, Firefox), with the four-step demo tour.

1. Turn the screen reader on and focus the Start button. Press Enter.
2. Expect the dialog name and the first step text to be read, for example "First, dialog" followed by the description.
3. Press Tab. Expect the close button to be announced by its label, then each footer button by its text.
4. Press Enter on Next. Expect the new dialog name and text to be read, and focus to stay inside the popover.
5. Press Escape. Expect the tour to close and focus to land on the Start button.
6. Start again and walk to the last step. Expect the button to read "Done".
7. On an action step, expect the instruction text to be read after the description. Complete the action and expect the feedback text to be announced.

Record the screen reader, browser, version and the result of each step in the pull request.
