# Avatar guide

The avatar presenter turns each step into a speech bubble with an animated character beside it. The tour itself does not change: the same steps, events, keyboard handling and persistence apply. This guide walks through setting it up and what to expect at run time. For every option and its edge cases, see the [avatar reference](./).

## Set it up

1. Import `base.css`, then `avatar.css`. Order matters: `avatar.css` builds on `base.css`.
2. Pass `withAvatar(pack, options)` as the tour's `presenter`.
3. Give steps a `title` and a `body` as usual. The bubble keeps the dialog's buttons, focus handling and accessible name.

<<< @/snippets/avatar/with-avatar.ts

The pack is the character: a sprite sheet plus a description of its animations. The package ships one, [Thumbtack](./thumbtack), loaded with `thumbtackPack()`. You can pass `withAvatar` a promise, so the page does not wait on the download before it builds the tour.

## What the character does

The presenter picks an animation for each step from the pack's roles. A role is a job such as `greet` or `point`; the pack says which of its animations does that job. A pack that lacks a role plays its `rest` animation instead.

| Moment | Role played |
|---|---|
| The first step shown, when it has no target | `greet` |
| A step with a target | `point`, aimed at the target (`point.left`, `point.right`, `point.up`, `point.down`, falling back to `point.any`, then `greet`, then `rest`) |
| A later step with no target | `defaultAnimation`, else `rest` |
| A step waiting for its target to appear | `think`, looping, until the target arrives |
| The user presses Next, an arrow key or the overlay on an unmet [action step](../guide/action-steps), or code calls `tour.nudge()` | `alert` |
| An action step's instruction is met | `celebrate` |
| The step has been quiet for `idleQuietMs` | a random `idle` animation |

The avatar re-aims when a reposition moves the bubble to the other side of the target. The pack's `exit` role is accepted and validated, but the presenter does not play it today.

A step overrides the automatic choice with `extensions.avatar.animation`. It takes an animation name, a role (`greet`) or a role path (`point.left`). It can also set `dock`, `idle` and `hidden`; see [step options](./#step-options).

<<< @/snippets/avatar/step-extensions.ts

## Idle behavior

After a step's animation ends, the avatar holds that animation's still frame and a timer starts. When it fires, the avatar plays a random animation from the pack's `idle` role, never the same one twice in a row, then returns to rest and waits again. `idle` is on by default and `idleQuietMs` defaults to 6000. A value of zero or less uses 6000, and a positive value below 50 is raised to 50.

Turn it off for the whole tour with `idle: false`, or per step with `extensions.avatar.idle`. The step's value wins. A looping step animation other than `rest` never arms the timer. Details are in [Idle](./#idle).

## Reduced motion

With `prefers-reduced-motion: reduce` the avatar does not animate. Each step's animation shows its still frame, the idle loop never starts, and the wait for the entrance fade is skipped. The bubble, text and buttons behave as usual. The pack decides which frame is the still one; see [make a pack](./make-a-pack#reduced-motion-and-still-frames).

## When the pack does not load

The avatar is an enhancement, so a failure must not break the tour. The presenter has fixed limits for every wait:

- **Load wait.** A run waits for the pack and its sheet image for up to `loadTimeoutMs`, 3000 by default and never more than 9000. A larger value counts as 9000. After one timeout or failure, later runs do not wait again: they use the pack if it has arrived and the dialog if not.
- **Engine bound.** The tour itself gives `Presenter.ready` at most 10 seconds. The 9000 cap keeps the avatar's own wait inside that bound.
- **Fallback.** If the pack fails to load, fails validation or is not ready in time, that run uses the plain dialog presenter. The run never switches presenters in the middle.
- **Late packs.** A pack that arrives after the time is up is used from the next run, not from the next step.
- **`onError`.** It is called once per `withAvatar` call, not once per run.

<<< @/snippets/avatar/guide-fallback.ts

To check a pack before the tour starts, call `loadAvatarPack` yourself and hand the resolved pack to `withAvatar`. A pack that is already loaded does not wait. `preloadSheet(url, { signal, timeoutMs })` warms the image cache; see [Loading helpers](./#loading-helpers).

## Styles and the production-only entry

`avatar.css` sets a marker custom property, `--vt-avatar-base`, on the speaker popover. In development builds the presenter reads it on the first mount of each run and warns if it is missing. The published avatar entry is a single production build, so that warning and the other development warnings never print from the published package. To confirm the stylesheet is loaded, look at the page: an unstyled bubble means the import is missing. [Production-only entry](./#production-only-entry) lists what is silent.

## Serving the pack from your own host

`thumbtackPack()` resolves the pack next to the avatar module. Bundlers that do not copy the package's `thumbtack/` folder need a base URL for the directory that holds it:

<<< @/snippets/avatar/thumbtack-cdn.ts

## Building the presenter yourself

`SpeakerPresenter` is the presenter `withAvatar` builds once the pack is ready. Use it directly when you already hold a loaded pack. `withAvatar` adds the waiting, the timeout, the fallback and `onError`; `SpeakerPresenter` has none of them. See [SpeakerPresenter](./#speakerpresenter).

## Accessibility

The avatar element is decorative and carries `aria-hidden`. The bubble announces and handles focus the way the dialog does, so a screen reader hears the same step with or without the character. Do not put information only in an animation.

## Next

- [Make a pack](./make-a-pack): draw your own character.
- [Classic packs](./classic-packs): load an existing paperclip-style character on your own responsibility.
- [Licensing](../licensing): what the project's code and art are released under.
