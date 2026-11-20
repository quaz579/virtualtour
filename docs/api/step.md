# Step reference

A step is described by a `StepConfig` and, once the tour is built, represented by a `TourStep` instance. This page lists every `StepConfig` key and every `TourStep` member. Tour-level options are in the [Config reference](./config).

<<< @/snippets/api/step-full.ts

## StepConfig

Defaults come from the tour's `stepDefaults` merged over the built-in ones. The built-in defaults are `whenMissing: "center"`, `closeButton: true`, `focus: "dialog"`, `reveal: true`, the `position` defaults below and `spotlight: { extra: [], targetInteractive: true }`.

### Content

| Key | Type | Default | Meaning |
|---|---|---|---|
| `id` | `string` | `step-<n>` | Unique within the tour. Needed for saved progress and for `goTo`, `stepById` and `dropStep`. |
| `title` | `string \| () => string` | none | HTML, passed through `sanitize`. A function runs each time the step shows. |
| `body` | `BodyContent` | none | A string (HTML), a string array (one `<p>` each), an `Element`, a `DocumentFragment`, or a function returning one of those, run each time the step shows. Strings and arrays go through `sanitize`. An element or fragment is deep-cloned into the popover on each mount, keeps no listeners and is not sanitized. |
| `label` | `string \| () => string` | none | Accessible name when the step has no title. A dev build warns once when a step has neither. |
| `closeButton` | `boolean \| { label?, attrs? }` | `true` | `false` hides the close button. `label` replaces its accessible name; `attrs` sets attributes on it. |
| `classes` | `string \| string[]` | none | Extra classes on the popover. |
| `meta` | `JsonValue` | none | Your own data. Never read by the engine. |
| `buttons` | `ButtonConfig[]` | none | Custom footer buttons. When set, the engine's Next and Back are hidden. Arrow keys still follow a `forward` or `backward` button. |
| `instruction` | `string \| () => string` | none | Makes the step an action step. See [Action steps](../guide/action-steps). |
| `advanceDelay` | `number` (ms) | `0` | How long a completed action step stays on screen before the tour moves on. |
| `focus` | `"dialog" \| "first-button"` | `"dialog"` | What receives focus when the step shows. |
| `extensions` | `Record<string, unknown>` | none | Namespaced data for presenters, for example `extensions.avatar`. Merged key by key with the defaults. |

`ButtonConfig`:

| Key | Type | Meaning |
|---|---|---|
| `text` | `string \| () => string` | Label, HTML passed through `sanitize`. |
| `label` | `string \| () => string` | Accessible name. |
| `action` | `"forward" \| "backward" \| "exit" \| "finish" \| (ctx: { tour, step }) => void` | What a click does. An unknown string logs a warning and does nothing. A throwing function is logged. |
| `disabled` | `boolean \| () => boolean` | Evaluated each time the footer is painted. |
| `kind` | `"primary" \| "secondary"` | `secondary` adds the secondary class. |
| `classes` | `string \| string[]` | Extra classes. |
| `attrs` | `Record<string, string>` | Extra attributes. |

### Targeting and placement

| Key | Type | Default | Meaning |
|---|---|---|---|
| `target` | `string \| Element \| () => string \| Element \| null \| undefined` | none | The element to highlight. No target means a centered popover. See [Steps and targets](../guide/steps-and-targets). |
| `placement` | `"auto" \| { side, align? }` | none | `side` is `top`, `bottom`, `left`, `right`, `auto` or `over`; `align` is `start`, `center` or `end`. With a target and no placement the target is highlighted and the popover is centered. See [Positioning](../guide/positioning). |
| `waitFor` | `number` (ms) | `0` | How long to wait for the target to appear. Bounded by the tour's `waitBudget`. |
| `whenMissing` | `"center" \| "skip"` | `"center"` | What to do when the target never appears. |
| `shouldShow` | `() => boolean` | none | Return `false` to skip the step. A throwing function is logged and skips the step. |
| `spotlight` | `SpotlightOptions` | see below | Cut-out options. |
| `position` | `PositionOptions` | see below | Popover positioning. |
| `reveal` | `boolean \| "smooth" \| ScrollIntoViewOptions` | `true` | How the target scrolls into view. `false` never scrolls. |
| `revealWith` | `(target: Element) => void \| Promise<void>` | none | Replaces the built-in scrolling. Runs only when a target was found. |

`SpotlightOptions`:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `padding` | `number` | `dim.padding` | Space around the target. |
| `radius` | `number \| CornerRadius` | `dim.radius` | Cut-out corner radius. |
| `extra` | `string[]` | `[]` | Selectors to cut out and keep interactive. They get the state classes after the next reposition. |
| `class` | `string` | none | Class added to the target and the extras. |
| `targetInteractive` | `boolean \| "hover-only"` | `true` | `false` blocks all interaction with the target; `"hover-only"` allows hover but not clicks. |

`PositionOptions`:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `offset` | `number \| { main?, cross? }` | `{ main: 10, cross: 0 }` | Gap between target and popover. `cross` slides along the edge the popover sits on: on `top` and `bottom` positive moves toward inline-end (left in right-to-left layouts), on `left` and `right` positive moves down. Ignored for `over` and centered steps. Non-finite values fall back to the default. |
| `viewportPadding` | `number` | `0` | Distance kept from the boundary. |
| `boundary` | `"viewport" \| "scrollParents"` | `"scrollParents"` | What the popover must stay inside. `scrollParents` narrows the viewport by the target's scrolling ancestors. |
| `flip` | `boolean` | `true` | Fall back to another side or alignment when the popover does not fit. |
| `shift` | `boolean` | `true` | Slide along the edge to stay inside the boundary. |
| `strategy` | `"fixed" \| "absolute"` | `"fixed"` | CSS positioning. Read only from the step's own `position.strategy` and `stepDefaults`. |
| `arrow` | `boolean \| { minInset? }` | `true`, `minInset` 15 | `false` hides the arrow. `minInset` is the closest the arrow gets to a corner; a negative or non-finite value falls back to 15. |

### Hooks and advancing

| Key | Type | Default | Meaning |
|---|---|---|---|
| `prepare` | `() => unknown \| Promise<unknown>` | none | Runs before the step shows, after its target was looked up. A throw is logged and the step shows anyway. |
| `hookTimeout` | `number` (ms) | `10000` | How long `prepare` and `revealWith` may each take. On timeout a warning is logged and the step shows anyway. `0` or `Infinity` waits forever. |
| `autoAdvance` | `{ event: string \| string[]; selector?: string; strict?: boolean }` | none | Moves on when the user does something. With `selector`, the first matching event anywhere in the document advances after the page's handlers ran, and `strict` is ignored. Without it, the engine listens on the target; `strict` blocks every other mouse gesture there and nudges. An invalid selector logs a warning and never advances. |

## TourStep

Created by the tour. Never construct one yourself. `tour.steps` lists them and `tour.stepById(id)` finds one.

| Member | Type | Meaning |
|---|---|---|
| `id` | `string` | The step id. |
| `tour` | `Tour` | The owning tour. |
| `config` | `Readonly<StepConfig>` | The step's configuration with defaults applied. |
| `element` | `HTMLElement \| undefined \| null` | The popover wrapper of the most recent show. `undefined` before the first show, `null` after `dispose`. |
| `resolvedTarget` | `Element \| null` | The element the step points at once resolved. `null` for a centered step. |
| `configure(patch)` | `(StepConfigPatch) => void` | Merges `patch` into the configuration. `id` and `undefined` values are ignored; arrays such as `buttons` are replaced. A `null` clears a field back to the tour's default for it (its `stepDefaults` value or the built-in one), or removes it when there is none; inside `position`, `spotlight`, `closeButton` and `extensions` a `null` clears just that key. That covers hooks such as `shouldShow` and `prepare` too, and a `null` `meta` removes `meta` rather than storing JSON `null`. `StepConfigPatch` is `StepConfig` with `null` allowed on every field. On a shown step the title, body, label, buttons, classes, close button and counter update in place with no events. Every other field, `target` and `position` included, applies the next time the step shows. |
| `show()` | `() => Promise<void>` | Same as `tour.goTo(step)`. |
| `hide()` | `() => void` | Removes the popover when this step is the current one. The tour keeps running. |
| `exit()` | `() => Promise<boolean>` | Same as `tour.exit()`. |
| `finish()` | `() => void` | Same as `tour.finish()`. |
| `dispose()` | `() => void` | Releases the element and target and emits `disposed` once. |
| `isShown()` | `() => boolean` | Whether the popover is on screen. |
| `on(event, fn, ctx?)` | returns `() => void` | Subscribes. The returned function unsubscribes. `ctx` becomes `this`. |
| `once(event, fn, ctx?)` | returns `() => void` | Like `on`, removed before its first call. |
| `off(event?, fn?)` | `void` | Removes every handler, every handler of one event, or one handler of one event. |

<<< @/snippets/api/step-instance.ts

### Step events

Each payload is `{ step: TourStep }`. A throwing handler is logged and the rest still run.

| Event | When |
|---|---|
| `will-show` | Before the popover is built. |
| `shown` | The popover is on screen. |
| `will-hide` | The step is about to leave. |
| `hidden` | The popover is gone. |
| `completed` | An action step's instruction was met. Only steps with an `instruction` emit it. |
| `finished` | The tour finished while this step was the last one reached. |
| `exited` | The tour was cancelled while this step was the last one reached. |
| `disposed` | The step was released, at the end of the run or when it was dropped. |
