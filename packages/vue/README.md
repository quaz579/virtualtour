# virtual-site-tour-vue

Vue provider and composable for [`virtual-site-tour`](https://www.npmjs.com/package/virtual-site-tour): `TourProvider` creates the tour, and `useTour()` exposes `isRunning`, `currentStep` and the navigation calls as refs.

[Live demo](https://quaz579.github.io/virtualtour/) · [Docs](https://github.com/quaz579/virtualtour#readme)

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

Requires `vue >= 3.3` and `virtual-site-tour` as peer dependencies. There is no plugin to install. `useTour()` must run in a component inside `<TourProvider>`.
