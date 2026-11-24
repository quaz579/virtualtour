# virtual-site-tour-vue

Vue provider and composable for `virtual-site-tour`: `TourProvider` creates the tour, and `useTour()` exposes `isRunning`, `currentStep` and the navigation calls as refs.

Requires `vue >= 3.3` and the `virtual-site-tour` package as peer dependencies. The tour is created on mount, so server rendering outputs the children only.
