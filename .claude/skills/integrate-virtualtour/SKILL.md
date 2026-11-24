---
name: integrate-virtualtour
description: Add a guided product tour or onboarding walkthrough to a web app with VirtualTour (npm packages virtual-site-tour, virtual-site-tour-react, virtual-site-tour-vue). Use when asked to add a product tour, onboarding tour, feature walkthrough, guided tour, step-by-step highlight or "show users around" to a site, or to integrate virtualtour. Detects the framework, installs the right package, writes a first tour against real elements, wires a start button and verifies it in a browser with Playwright.
---

# Integrate VirtualTour

VirtualTour spotlights elements on a page and explains them in popovers, step by step. Live demo: https://quaz579.github.io/virtualtour/. Full API in one file: https://raw.githubusercontent.com/quaz579/virtualtour/main/llms.txt.

Work through the steps in order. Do not skip step 6.

## 1. Detect the framework

Read the app's `package.json` (in a monorepo, the package that renders the page):

| Found in dependencies | Use | Install |
|---|---|---|
| `react`, `next`, `@remix-run/react`, `gatsby` | React wrapper | `virtual-site-tour virtual-site-tour-react` |
| `vue`, `nuxt` | Vue wrapper | `virtual-site-tour virtual-site-tour-vue` |
| anything else (plain HTML, Svelte, Angular, Astro, server-rendered pages) | core library | `virtual-site-tour` |

Pick the package manager from the lockfile: `package-lock.json` npm, `pnpm-lock.yaml` pnpm, `yarn.lock` yarn, `bun.lockb` or `bun.lock` bun. A site with no build step can load the ESM build from a CDN (`https://cdn.jsdelivr.net/npm/virtual-site-tour/dist/index.js` and `dist/base.css`).

## 2. Install

```sh
npm install virtual-site-tour
```

Add `virtual-site-tour-react` or `virtual-site-tour-vue` for those frameworks. All three are ESM only, need no other runtime dependencies and are safe to import during server rendering.

## 3. Choose the steps

Pick 2 to 5 elements the user should notice, on a page that renders them without login if you can. For each, find a stable selector: an existing `id`, or add a `data-tour="..."` attribute and target `[data-tour="..."]`. Avoid generated class names. End with a step that has no `target`; it is centered on the page.

## 4. Write the tour

Rules that matter:

- Import `virtual-site-tour/base.css` once. Without it the popover is unstyled. Add `virtual-site-tour/theme.css` for the default colors and dark mode.
- `dim` is off by default. `dim: true` darkens the page around the target.
- A step with a `target` and no `placement` highlights the target but centers the popover. Set `placement: { side: "bottom" }` (or `top`, `left`, `right`, `auto`) to anchor it.
- `title` and `body` are HTML strings. Pass `sanitize` if any text comes from users.
- Give the tour an `id` and each step an `id`.

### Plain JavaScript or TypeScript

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

`useTour()` only works in a component rendered inside `<TourProvider>`. In the Next.js App Router, put this in a file that starts with `"use client";`.

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

### Vue

There is no plugin and no `app.use`. `useTour()` must run in a child of `<TourProvider>`. In Nuxt, render it inside `<ClientOnly>` or a client-only component.

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

## 5. Wire the start trigger

- A visible button (as above) is the default. Keep it in the app so users can replay the tour.
- To start automatically, pass `autoStart` to `TourProvider`, or call `tour.start()` after the page has rendered (never during server rendering; `start()` rejects without a browser).
- To show it only once per browser, add `progress: { store: localStorageStore() }` to the config (import `localStorageStore` from `virtual-site-tour`). A finished tour then emits `bypassed` instead of starting again.

## 6. Verify in a real browser

Run the app (`npm run dev` or the project's equivalent), then drive it with Playwright. Adapt the selectors and titles to the tour you wrote:

```ts
import { expect, test } from "@playwright/test";

test("product tour starts, advances and closes", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.click("#start-tour");

  const popover = page.locator(".vt-popover");
  await expect(popover).toBeVisible();
  await expect(page.locator(".vt-popover-title")).toHaveText("Save your work");
  await expect(page.locator("#save")).toHaveClass(/vt-target/);

  await page.click(".vt-popover-next-btn");
  await expect(page.locator(".vt-popover-title")).toHaveText("You're all set");

  await page.click(".vt-popover-next-btn");
  await expect(popover).toHaveCount(0);
  expect(errors).toEqual([]);
});
```

If the project has no Playwright yet: `npm install -D @playwright/test && npx playwright install chromium`, then run `npx playwright test` with `use: { baseURL: "http://localhost:<port>" }` in `playwright.config.ts`. Report the result. A tour that is not seen working in a browser is not done.

Popover DOM: `.vt-popover`, `.vt-popover-title`, `.vt-popover-description`, `.vt-popover-next-btn`, `.vt-popover-prev-btn`, `.vt-popover-close-btn`. The target gets the class `vt-target`; the overlay is `svg.vt-overlay`. Escape exits; the arrow keys move.

## Common additions

Gated step: the user must click the target to continue. Next only nudges until they do.

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

Animated avatar: copy `node_modules/virtual-site-tour/dist/thumbtack` to a static folder served at `/vt/thumbtack/` (Vite: `public/vt/thumbtack`). If the pack fails to load, the tour shows the plain popover.

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

Tour as JSON, served as `/tours/welcome.json`:

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

Theme: override CSS variables after importing `theme.css`, for example `:root { --vt-accent: #0f766e; --vt-radius: 12px; }`. Other variables: `--vt-bg`, `--vt-fg`, `--vt-muted`, `--vt-space`, `--vt-shadow`, `--vt-font`.

## Essential API

```ts
createTour(config: TourConfig): Tour
// TourConfig: id, name, steps, stepDefaults, dim, counter, labels { next, back, done, close },
//   exitPrompt, keys { escape, arrows }, progress { store, skipCompleted, resume }, presenter, sanitize, animate
// StepConfig: id, title, body, target, placement, position, spotlight, waitFor, whenMissing,
//   shouldShow, prepare, buttons, instruction, autoAdvance, advanceDelay, extensions
tour.start() / tour.forward() / tour.backward() / tour.goTo(idOrIndex) / tour.exit() / tour.finish()
tour.isRunning(); tour.currentStep; tour.progressInfo()
tour.on("step-shown" | "finished" | "exited" | "step-completed" | "bypassed", handler) // returns an unsubscribe function
```

Every option with its type and default: [llms.txt](https://github.com/quaz579/virtualtour/blob/main/llms.txt), [tour configuration](https://github.com/quaz579/virtualtour/blob/main/docs/api/config.md), [step configuration](https://github.com/quaz579/virtualtour/blob/main/docs/api/step.md), [tour and step objects](https://github.com/quaz579/virtualtour/blob/main/docs/api/tour.md), [framework wrappers](https://github.com/quaz579/virtualtour/blob/main/docs/guide/framework-wrappers.md).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Popover has no styling, page still clickable | `virtual-site-tour/base.css` not imported |
| No dark overlay | `dim: true` missing |
| Popover centered instead of next to the element | step has `target` but no `placement` |
| Step shows centered with no highlight | selector matched nothing; add `waitFor: 3000` for elements that render late |
| `useTour() must be called inside a <TourProvider>` | `useTour()` is in the same component that renders the provider; move it to a child |
| `TourEnvironmentError` | `start()` ran on the server |
| Avatar missing, plain popover shown | Thumbtack files not served at the base URL passed to `thumbtackPack` |
