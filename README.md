# VirtualTour

Guided product tours and onboarding for any web page: spotlight an element, explain it in a popover, and walk users through your app step by step. Works with plain JavaScript, React and Vue. MIT, no runtime dependencies.

**[Live demo](https://quaz579.github.io/virtualtour/)**

[![virtual-site-tour](https://img.shields.io/npm/v/virtual-site-tour?label=virtual-site-tour)](https://www.npmjs.com/package/virtual-site-tour)
[![virtual-site-tour-react](https://img.shields.io/npm/v/virtual-site-tour-react?label=virtual-site-tour-react)](https://www.npmjs.com/package/virtual-site-tour-react)
[![virtual-site-tour-vue](https://img.shields.io/npm/v/virtual-site-tour-vue?label=virtual-site-tour-vue)](https://www.npmjs.com/package/virtual-site-tour-vue)
[![license](https://img.shields.io/npm/l/virtual-site-tour)](LICENSE)

| Package | Use it for |
|---|---|
| [`virtual-site-tour`](https://www.npmjs.com/package/virtual-site-tour) | The library. Required in every setup. |
| [`virtual-site-tour-react`](https://www.npmjs.com/package/virtual-site-tour-react) | `TourProvider` and `useTour()` for React 18+. |
| [`virtual-site-tour-vue`](https://www.npmjs.com/package/virtual-site-tour-vue) | `TourProvider` and `useTour()` for Vue 3.3+. |

The packages are ESM only and run in the browser. They are safe to import during server rendering; a tour only starts on the client.

## Quickstart

Each example builds the same two-step tour: one step that spotlights a Save button, then a centered closing step.

### Plain JavaScript or TypeScript

```sh
npm install virtual-site-tour
```

```html
<button id="save">Save</button>
<button id="start-tour">Take the tour</button>
```

```ts
import "virtual-site-tour/base.css";
import "virtual-site-tour/theme.css";
import { createTour } from "virtual-site-tour";

const tour = createTour({
  id: "welcome",
  dim: true,
  steps: [
    {
      id: "save",
      target: "#save",
      placement: { side: "bottom", align: "start" },
      title: "Save your work",
      body: "Changes stay in this browser until you press Save.",
    },
    { id: "done", title: "You're all set", body: "Press Done to close the tour." },
  ],
});

document.querySelector("#start-tour")?.addEventListener("click", () => {
  void tour.start();
});
```

### React

```sh
npm install virtual-site-tour virtual-site-tour-react
```

```tsx
import "virtual-site-tour/base.css";
import "virtual-site-tour/theme.css";
import type { TourConfig } from "virtual-site-tour";
import { TourProvider, useTour } from "virtual-site-tour-react";

const config: TourConfig = {
  id: "welcome",
  dim: true,
  steps: [
    { id: "save", target: "#save", placement: { side: "bottom" }, title: "Save your work", body: "Changes stay in this browser until you press Save." },
    { id: "done", title: "You're all set" },
  ],
};

function StartTourButton() {
  const { start, isRunning } = useTour();
  return (
    <button id="start-tour" disabled={isRunning} onClick={() => void start()}>
      Take the tour
    </button>
  );
}

export default function App() {
  return (
    <TourProvider config={config}>
      <button id="save">Save</button>
      <StartTourButton />
    </TourProvider>
  );
}
```

`useTour()` must be called in a component rendered inside `<TourProvider>`. Pass `autoStart` to start the tour on mount.

### Vue

```sh
npm install virtual-site-tour virtual-site-tour-vue
```

`src/App.vue`:

```vue
<script setup lang="ts">
import "virtual-site-tour/base.css";
import "virtual-site-tour/theme.css";
import type { TourConfig } from "virtual-site-tour";
import { TourProvider } from "virtual-site-tour-vue";
import StartTourButton from "./StartTourButton.vue";

const config: TourConfig = {
  id: "welcome",
  dim: true,
  steps: [
    { id: "save", target: "#save", placement: { side: "bottom" }, title: "Save your work", body: "Changes stay in this browser until you press Save." },
    { id: "done", title: "You're all set" },
  ],
};
</script>

<template>
  <TourProvider :config="config">
    <button id="save">Save</button>
    <StartTourButton />
  </TourProvider>
</template>
```

`src/StartTourButton.vue`:

```vue
<script setup lang="ts">
import { useTour } from "virtual-site-tour-vue";

const { start, isRunning } = useTour();
</script>

<template>
  <button id="start-tour" :disabled="isRunning" @click="start()">Take the tour</button>
</template>
```

There is no Vue plugin to install. `useTour()` must run in the `setup` of a component inside `<TourProvider>`.

### Things that trip people up

- **Import `virtual-site-tour/base.css`.** Without it the popover is unstyled and the overlay does not block clicks. `theme.css` is optional and adds colors, dark mode and an entrance animation.
- **`dim` is off by default.** Pass `dim: true` to darken the page around the highlighted element.
- **A step with a `target` but no `placement` highlights the target and centers the popover.** Set `placement: { side: "bottom" }` (or `top`, `left`, `right`, `auto`) to anchor the popover to the target.
- **`start()` needs a browser.** Call it from a click handler or an effect, never during server rendering.

## Core concepts

| Concept | What it is | Where to read more |
|---|---|---|
| Tour | `createTour(config)` returns a `Tour`. Drive it with `start()`, `forward()`, `backward()`, `goTo(id)`, `exit()` and `finish()`, and listen with `on(event, fn)`. | [Getting started](docs/guide/getting-started.md), [Tour API](docs/api/tour.md) |
| Step | One popover. `title` and `body` (HTML string, list of paragraphs, element or function), an optional `target` (selector, element or function) and an optional `id`. | [Steps and targets](docs/guide/steps-and-targets.md) |
| Placement | `placement: "auto"` or `{ side, align }`, with `side` one of `top`, `bottom`, `left`, `right`, `auto`, `over`. Fine-tune with `position` (offset, flip, shift, arrow). | [Positioning](docs/guide/positioning.md) |
| Spotlight | `dim: true` (or a `DimConfig`) draws the overlay with a cut-out around the target. Per step, `spotlight` sets padding, radius, extra cut-outs and whether the target stays clickable. | [Overlay](docs/guide/overlay.md) |
| Action steps | `instruction` gates a step: Next nudges until the user does the thing. `autoAdvance: { event: "click" }` (or `tour.advance()`) completes it. | [Action steps](docs/guide/action-steps.md) |
| Avatars | `withAvatar(pack)` from `virtual-site-tour/avatar` turns each popover into a speech bubble with an animated character. Ships the Thumbtack pack. | [Avatar guide](docs/avatar/guide.md) |
| JSON tours | Describe a tour as data (`"format": "virtualtour-tour/1"`) and load it with `parseTourJson`. A JSON Schema ships in the package. | [JSON tours](docs/guide/json-tours.md) |
| Persistence | `progress: { store: localStorageStore() }` skips finished tours and can resume where the user left off. | [Persistence](docs/guide/persistence.md) |

### Action (gated) step

The user must click Save before the tour moves on:

```ts
import "virtual-site-tour/base.css";
import { createTour } from "virtual-site-tour";

const tour = createTour({
  dim: true,
  steps: [
    {
      id: "click-save",
      target: "#save",
      placement: { side: "bottom" },
      title: "Try it",
      instruction: "Click <b>Save</b> to continue.",
      autoAdvance: { event: "click" },
    },
    { id: "saved", title: "Nice, it's saved" },
  ],
});

document.querySelector("#start-tour")?.addEventListener("click", () => {
  void tour.start();
});
```

### Avatar

Copy the Thumbtack pack out of the package into your static folder so it is served at `/vt/thumbtack/`. With Vite that folder is `public/`:

```sh
mkdir -p public/vt && cp -R node_modules/virtual-site-tour/dist/thumbtack public/vt/
```

```ts
import "virtual-site-tour/base.css";
import "virtual-site-tour/theme.css";
import "virtual-site-tour/avatar.css";
import { createTour } from "virtual-site-tour";
import { thumbtackPack, withAvatar } from "virtual-site-tour/avatar";

const tour = createTour({
  presenter: withAvatar(thumbtackPack("/vt/"), {
    onError: (error) => console.warn(`Avatar unavailable: ${error.message}`),
  }),
  steps: [
    { id: "hello", title: "Hi, I'm Thumbtack", body: "Let me show you around." },
    { id: "save", target: "#save", placement: { side: "bottom" }, title: "Save", body: "Your work is kept here." },
  ],
});

document.querySelector("#start-tour")?.addEventListener("click", () => {
  void tour.start();
});
```

If the pack cannot load, the tour falls back to the plain popover and `onError` is called.

### JSON tour

Serve this file as `/tours/welcome.json` (with Vite, put it in `public/tours/`):

```json
{
  "$schema": "https://unpkg.com/virtual-site-tour/schemas/tour.v1.schema.json",
  "format": "virtualtour-tour/1",
  "id": "welcome",
  "dim": true,
  "steps": [
    { "id": "save", "target": "#save", "placement": { "side": "bottom" }, "title": "Save your work" },
    { "id": "done", "title": "You're all set" }
  ]
}
```

```ts
import "virtual-site-tour/base.css";
import { createTour, parseTourJson } from "virtual-site-tour";

async function startWelcomeTour() {
  const response = await fetch("/tours/welcome.json");
  const tour = createTour(parseTourJson(await response.json()));
  await tour.start();
}

document.querySelector("#start-tour")?.addEventListener("click", () => {
  void startWelcomeTour();
});
```

Functions (button actions, `shouldShow`, `prepare`) are referenced by name, `{ "handler": "openSettings" }`, and supplied through `parseTourJson(json, { handlers })`.

## API reference

- [Tour configuration](docs/api/config.md): every `TourConfig` option.
- [Step configuration](docs/api/step.md): every `StepConfig` option.
- [Tour and step objects](docs/api/tour.md): methods, events and exit reasons.
- [Avatar reference](docs/avatar/index.md): `withAvatar`, packs and step options.
- [`llms.txt`](llms.txt): the whole public API in one plain-text file.

Entry points: `virtual-site-tour` (core), `virtual-site-tour/avatar`, `virtual-site-tour/motion`, and the stylesheets `virtual-site-tour/base.css`, `theme.css` and `avatar.css`.

## Theming

Import `virtual-site-tour/theme.css` after `base.css`, then override CSS variables on `:root`:

```css
:root {
  --vt-accent: #0f766e;
  --vt-radius: 12px;
  --vt-space: 20px;
}
```

The main variables are `--vt-accent`, `--vt-bg`, `--vt-fg`, `--vt-muted`, `--vt-radius`, `--vt-space`, `--vt-shadow`, `--vt-font` and `--vt-enter-duration`. Dark mode follows `prefers-color-scheme`; set `data-vt-theme="dark"` or `"light"` on `<html>` to force one. Every class, attribute and variable is listed in [`packages/core/STYLES.md`](packages/core/STYLES.md). See [Styling](docs/guide/styling.md).

## Using with an AI assistant

The repository is set up so a coding agent with no prior context can add a tour to a site:

- [`llms.txt`](llms.txt) is a plain-text index of the docs plus the full public API. Point your assistant at `https://raw.githubusercontent.com/quaz579/virtualtour/main/llms.txt`.
- [`AGENTS.md`](AGENTS.md) is the contract for agents working on this repository: commands, layout and conventions.
- [`.claude/skills/integrate-virtualtour/SKILL.md`](.claude/skills/integrate-virtualtour/SKILL.md) is an agent skill that walks through detecting the framework, installing the right package, writing a first tour, wiring a start button and checking it in a browser.

To use the skill in your own project, copy it into that project's `.claude/skills/` folder:

```sh
npx degit quaz579/virtualtour/.claude/skills/integrate-virtualtour .claude/skills/integrate-virtualtour
```

or without degit:

```sh
mkdir -p .claude/skills/integrate-virtualtour
curl -fsSL https://raw.githubusercontent.com/quaz579/virtualtour/main/.claude/skills/integrate-virtualtour/SKILL.md -o .claude/skills/integrate-virtualtour/SKILL.md
```

Then ask your assistant to "add a product tour with virtualtour". Package versions after 1.0.2 also ship `llms.txt` and the skill inside `node_modules/virtual-site-tour/`.

## Coming from driver.js

VirtualTour is a fork of [driver.js](https://github.com/kamranahmedse/driver.js) 1.12.1. The [migration guide](docs/migration/from-driverjs.md) maps driver.js options and calls to their VirtualTour equivalents.

## Contributing

See [`AGENTS.md`](AGENTS.md) for build, test and release commands. Releases are automatic: merging a Conventional Commit to `main` publishes all three packages ([RELEASING.md](RELEASING.md)).

## Known limitations

Screen-reader behavior is verified with automated axe checks, but has not yet been manually tested with VoiceOver or other screen readers.

## License

MIT. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). The Thumbtack art is CC0.
