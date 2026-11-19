---
layout: home
hero:
  name: VirtualTour
  text: Guided tours for the web
  tagline: Highlight parts of your page, explain them step by step, and keep the page usable. A fork of driver.js with typed events, richer steps and no runtime dependencies.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Coming from driver.js
      link: /migration/from-driverjs
features:
  - title: Steps that wait and adapt
    details: Wait for a target to appear, skip it, show a step only when a condition holds, or run async work before a step is shown.
    link: /guide/steps-and-targets
  - title: Placement you control
    details: Sides, alignment, automatic side choice, flip and shift switches, offsets, scroll-parent boundaries and right-to-left layouts.
    link: /guide/positioning
  - title: Typed events
    details: Subscribe to tours and steps, or to every tour at once through the registry. The order of events is fixed.
    link: /guide/events-and-lifecycle
  - title: Action steps
    details: Ask the user to do something, then move on when they have. Advance from code or from a page event.
    link: /guide/action-steps
  - title: Tours as data
    details: Describe a tour in versioned JSON, validate it against a schema, and save progress between visits.
    link: /guide/json-tours
  - title: Accessible by default
    details: Focus is trapped and restored, step changes are announced, and motion follows the user's reduced-motion setting.
    link: /guide/accessibility
---

## A tour in one file

<<< @/snippets/guide/first-tour.ts

Read [Getting started](/guide/getting-started) for the walk-through, or [How it works](/guide/how-it-works) to see how the library relates to driver.js.

VirtualTour is released under the MIT license. The tour engine derives from driver.js 1.12.1 by Kamran Ahmed.
