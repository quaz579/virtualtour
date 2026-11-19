# Framework wrappers

`virtualtour-react` and `virtualtour-vue` are thin wrappers. Each gives you a `TourProvider` that owns one tour and a `useTour()` function that reads it. Neither wraps the tour in a new API: `tour` is the same `Tour` object you get from `createTour`, and you configure it with the same `TourConfig`. Both packages list `virtualtour` as a peer dependency, so install it next to them. React needs 18 or later; Vue needs 3.3 or later.

What the two share:

- The provider creates the tour while it renders (React) or sets up (Vue), so server rendering works. A tour only starts in the browser, after mount.
- `config` is read once. A new config object does not change a running provider.
- `autoStart` starts the tour once after mount. It does nothing when a run is already active, does not restart a tour that finished, and does not stop a running tour if you turn it off.
- Unmounting the provider ends a running tour without asking the exit prompt.
- `useTour()` throws outside a provider.
- `start`, `forward`, `backward`, `exit` and `finish` are the tour's own methods, bound. They are stable between renders.
- A rejected `start()` from `autoStart` is logged with `console.error`, not thrown.

## React

Wrap the part of the tree that needs the tour in `TourProvider` and call `useTour()` below it.

<<< @/snippets/guide/react-provider.tsx

`useTour()` returns:

| Field | Meaning |
|---|---|
| `tour` | The `Tour` object. |
| `isRunning` | Whether a run is active. |
| `currentStep` | The `TourStep` on screen, or `null`. |
| `start()`, `forward()`, `backward()`, `exit()`, `finish()` | The tour's methods. `exit()` resolves to whether the tour exited. |

`isRunning` and `currentStep` update on the tour events `started`, `step-shown`, `finished`, `exited` and `deactivated`. A step you drop while it is on screen is not reflected until the next of those events.

### Rebuild with a new key

The provider reads `config` once, so a new object in a re-render does nothing. To build a new tour from a new config, give the provider a different `key`. React unmounts the old provider, which ends the old run, and mounts a new one.

<<< @/snippets/guide/react-rebuild.tsx

### Strict mode

React strict mode mounts, unmounts and mounts every component once more in development. The provider ignores that extra cycle: it keeps the same tour instance, does not start a second run and does not end the first. A real unmount still ends the run.

### Unmount and saved progress

When the provider unmounts while a tour runs, it exits the tour with the reason `api`, without the exit prompt. A tour that has a `progress` store saves that exit like any other: the record gets an `exitedAt` time and the last step shown. A route change that unmounts the provider in the middle of a tour therefore records a dismissal. A new `key` ends the old run the same way.

### Exit prompts

If the config has a string `exitPrompt`, the provider replaces it with an async prompt that calls `window.confirm` with your text. The tour's own handling of a string prompt is synchronous, so `tour.exit()` resolves a little later with the provider than it does with a plain `createTour`. A function prompt is wrapped too. In both cases an unmount that happens while the prompt is open releases it and ends the run.

## Vue

`virtualtour-vue` exports `TourProvider` and `useTour`. There is no plugin to install: do not call `app.use` and do not look for `provideTour`. Render `TourProvider` where you want the tour and call `useTour()` in the `setup` of a component below it.

<<< @/snippets/guide/vue-provider.ts

`TourProvider` takes the props `config` (required) and `autoStart` (default `false`), and renders its default slot. `useTour()` returns:

| Field | Meaning |
|---|---|
| `tour` | The `Tour` object. |
| `isRunning` | A readonly ref of whether a run is active. |
| `currentStep` | A readonly ref of the `TourStep` on screen, or `null`. |
| `start()`, `forward()`, `backward()`, `exit()`, `finish()` | The tour's methods. |

The refs update on the same five events as in React. The provider subscribes after mount, so on the server they hold their initial values.

### Rebuild with a new key

Vue also remounts a component when its `key` changes. Changing the key of `TourProvider` ends the old run (reason `api`, no prompt) and creates a new tour from the new config.

<<< @/snippets/guide/vue-rebuild.ts

### Unmount, saved progress and exit prompts

These behave as in React. Unmounting exits with the reason `api`, which a `progress` store records as an exit. A string or function `exitPrompt` is wrapped so that an unmount releases an open prompt. Vue has no strict-mode double mount, so there is nothing extra to know there.

## Related

- [Events and lifecycle](./events-and-lifecycle) lists the events that drive `isRunning` and `currentStep`.
- [Persistence](./persistence) explains what a `progress` store saves.
