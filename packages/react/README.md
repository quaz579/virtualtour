# virtualtour-react

React provider and hook for `virtualtour`: `TourProvider` creates the tour once, and `useTour()` exposes `isRunning`, `currentStep` and the navigation calls.

Requires `react >= 18` and the `virtualtour` package as peer dependencies. The tour is created in an effect, so server rendering outputs the children only.
