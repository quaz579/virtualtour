# Steps and targets

A tour is an ordered list of steps. Each step has content (title and body), an optional target element to highlight, and options for when and how it shows. This page covers how to define steps, how targets are found, and how a step is prepared before it appears.

## Define steps

Pass `steps` to `createTour`. Every field is optional, so a step with only a title is a valid, centered message.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `id` | `string` | `step-1`, `step-2`, ... | Identifies the step. Must be unique in the tour. Required for [persistence](./persistence). |
| `title` | `string \| () => string` | none | HTML for the heading. A function runs each time the step shows. |
| `body` | `string \| string[] \| Element \| DocumentFragment \| function` | none | Step content. See [Body content](#body-content). |
| `label` | `string \| () => string` | none | Accessible name used when the step has no title. |
| `closeButton` | `boolean \| { label?, attrs? }` | `true` | `false` hides the close button. Escape still closes the tour unless `keys.escape` is `false`. |
| `classes` | `string \| string[]` | none | Extra classes on the popover. |
| `buttons` | `ButtonConfig[]` | none | Custom footer buttons. When set, the Back and Next buttons are hidden. |
| `meta` | JSON value | none | Your own data. The library never reads it. |
| `extensions` | `Record<string, unknown>` | none | A namespaced bag for presenters. |

A duplicate `id` throws `TourNavigationError` when the tour is created. Steps without an `id` get `step-<n>` for the next unused number. Those generated ids shift when you reorder steps, so give steps explicit ids if you save progress or call `goTo("id")`.

A development build logs one warning per tour when a step has neither a `title` nor a `label`, because the dialog then has no accessible name.

## Target elements

`target` says which element to highlight. The popover sits next to the target. Without a target the popover is centered and nothing is highlighted.

| Form | Notes |
|---|---|
| Selector string | Resolved with `document.querySelector`. An invalid selector counts as "not found". |
| `Element` | Must be connected to the document when the step shows. A detached element counts as "not found". |
| Function | Returns a selector, an element, `null` or `undefined`. A function that throws counts as "not found". |

<<< @/snippets/guide/steps-and-targets-targets.ts

The target is looked up when the tour moves to the step, before `prepare` runs. After that the same element is used until the step hides.

### When the target is missing

| Option | Type | Default | Meaning |
|---|---|---|---|
| `waitFor` | `number` (ms) | `0` | How long to wait for the target to appear. The tour watches the document for changes and also polls every 250 ms. |
| `whenMissing` | `"center" \| "skip"` | `"center"` | What to do when the target never appears. `center` shows the step centered with no highlight. `skip` moves on to the next eligible step. |

While the tour waits, the step on screen stays visible with `aria-busy="true"` and the `vt-waiting` class on the popover. Calling `exit()` or `finish()` ends the wait.

`waitFor` is bounded by the tour-level `waitBudget`. See [Time limits](#time-limits).

`goTo()` with a step reference shows that step even when its `shouldShow` returns `false` or its target is missing with `whenMissing: "skip"`. It still waits for `waitFor`.

## Decide whether a step shows

`shouldShow` returns `false` to skip the step. It runs each time the tour considers the step, in both directions. A function that throws is logged with `console.error` and the step is skipped.

Moving forward past the last eligible step finishes the tour. Moving backward when no earlier step is eligible exits it, with reason `api` and without the exit prompt.

## Prepare the page

Two hooks let you change the page before a step appears.

| Option | Type | Meaning |
|---|---|---|
| `prepare` | `() => unknown \| Promise<unknown>` | Runs once the step is chosen and its target is found. Open a panel, switch a tab, load data. |
| `revealWith` | `(target: Element) => void \| Promise<void>` | Replaces the built-in scrolling. Runs only when the step has a target. |
| `reveal` | `boolean \| "smooth" \| ScrollIntoViewOptions` | How the target scrolls into view when it is not visible. Default `true`. `false` never scrolls. |

The order for one step is: `shouldShow`, find the target (with `waitFor`), `prepare`, `revealWith` or built-in scrolling, then the step shows.

Because the target is found before `prepare` runs, an element that `prepare` creates is not picked up. If the target was found earlier but was removed during `prepare`, it is looked up again. Put elements your hook creates behind `waitFor` on the previous step, or create them in a hook that runs earlier.

A hook that throws or rejects is logged with `console.error` and the step still shows.

<<< @/snippets/guide/steps-and-targets-hooks.ts

### Time limits

Two options keep a stuck page from freezing the tour. Both log a `console.warn` when they cut something short, and the tour carries on.

| Option | Where | Default | Bounds |
|---|---|---|---|
| `hookTimeout` | step (or `stepDefaults`) | `10000` ms | How long `prepare` and `revealWith` may each take to settle. On timeout the step shows anyway, as it does when the hook throws. `0` or `Infinity` waits forever. |
| `waitBudget` | tour | `10000` ms | The total time one navigation may spend waiting for targets across consecutive steps that have `waitFor`. It also bounds a progress store `load` and each wait for a pending save. `0` or `Infinity` removes the cap; `NaN` or a negative value uses the default. |

A navigation is one move: a `forward()`, a `goTo()`, or the first show of a run. The first step that has to wait always gets its full `waitFor`. Later steps in the same move share what is left. Once the budget is spent, remaining steps are judged on what is on the page right now and follow their `whenMissing`. This matters when several steps in a row are skipped or have `whenMissing: "skip"`.

## Body content

`body` accepts these forms.

| Form | Result |
|---|---|
| String | One block of HTML. |
| `string[]` | One `<p>` per entry. |
| `Element` or `DocumentFragment` | A deep clone is placed in the popover each time the step shows. The original is never moved. The clone has no event listeners and no script-set state. |
| Function | Called each time the step shows. May return any of the above. |

Strings in `title`, `body` and `buttons` text pass through the tour's `sanitize` hook when one is set. Elements and fragments do not, because they are DOM, not HTML. See [Sanitizing HTML](../cookbook/sanitizing-html).

Custom `buttons` take `text`, an optional `label`, `action`, and optional `disabled`, `kind` (`primary` or `secondary`), `classes` and `attrs`. `action` is `forward`, `backward`, `exit`, `finish`, or a function that receives `{ tour, step }`. When you set `buttons`, the arrow keys follow them: ArrowRight works only if a button has the `forward` action, and ArrowLeft only if one has `backward`.

<<< @/snippets/guide/steps-and-targets-body.ts

## Shared defaults

`stepDefaults` is merged under every step. `position`, `spotlight`, `closeButton` and `extensions` merge key by key. Everything else, including arrays such as `buttons`, is replaced by the step's own value.

<<< @/snippets/guide/steps-and-targets-defaults.ts

## Change steps while the tour runs

| Method | What it does |
|---|---|
| `tour.appendStep(config, at?)` | Adds a step at the end, at a zero-based index, or before the step with the given id. Returns the step. Throws `TourNavigationError` for a bad index, an unknown id or a duplicate id. |
| `tour.dropStep(idOrStep)` | Removes a step. If it was on screen, the tour moves to the step that followed it, or exits without a prompt when none did. An unknown reference does nothing. |
| `step.configure(patch)` | Merges new options into a step. Title, body, label, buttons, classes and the close button update in place, with no events. Everything else, `target` and `position` included, applies the next time the step shows. |
| `tour.stepById(id)` | Finds a step. |
| `tour.goTo(ref?)` | Shows a step by index, id or instance. Starts the tour if it is not running. |
| `tour.hideCurrent()` | Removes the popover but keeps the run active. The next navigation shows a step again. |

<<< @/snippets/guide/steps-and-targets-dynamic.ts

The counter and the progress info count every step, skipped ones included.

Next: [Positioning](./positioning) controls where the popover sits, and [Events and lifecycle](./events-and-lifecycle) shows what fires as steps change.
