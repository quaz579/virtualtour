# virtual-site-tour-react

React provider and hook for [`virtual-site-tour`](https://www.npmjs.com/package/virtual-site-tour): `TourProvider` creates the tour once, and `useTour()` exposes `isRunning`, `currentStep` and the navigation calls.

[Live demo](https://quaz579.github.io/virtualtour/) · [Docs](https://github.com/quaz579/virtualtour#readme)

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

Requires `react >= 18` and `virtual-site-tour` as peer dependencies. The tour is created during render, so server rendering outputs the children only; it starts in the browser. `useTour()` must be called in a component inside `<TourProvider>`.
