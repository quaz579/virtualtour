# Demo

The demo is a small sample app with a scenario picker. Each scenario runs a real tour against it, so you can see
placement, spotlight, action steps, theming, right-to-left layout, motion, JSON tours and the avatar presenter working
together.

Run it from the repository root:

```sh
npm run dev --workspace virtualtour-demo
```

Then open the printed address. Set the port with `VT_E2E_PORT` if the default is taken.

## Scenarios

| Scenario | What it shows |
|---|---|
| Core tour | A centered step, targeted steps, counter, back and next |
| Placement | Sides, alignment, `auto`, flipping and `arrow: false` |
| Spotlight | Per-step padding and radius, extra cut-outs, a locked target |
| Action steps | Steps that wait for a focus and a click |
| JSON tour | `demo/tours/showcase.tour.json` parsed with `parseTourJson` |
| Motion | `glide()` and `progressVars()` from `virtualtour/motion` |
| Avatar (Thumbtack) | `withAvatar` with the bundled pack and the idle loop |
| Avatar (classic format) | `loadClassicAvatarPack` with the generated test sheet |

The Theme and Direction selectors switch between light and dark and between left to right and right to left while a
tour runs. The React and Vue wrapper pages are linked from the picker.

## URL parameters

`/?scenario=placement&theme=dark&dir=rtl` starts the placement scenario in dark mode with right-to-left layout.

## Pages the end-to-end suite uses

Every end-to-end spec loads a page from `demo/`. A unit test (`test/demo-fixtures.node.test.ts`) fails when a spec
points at a page that does not exist or is missing from the demo build.

## Screenshot gallery

```sh
VT_GALLERY_DIR=/tmp/vt-gallery npm run e2e -- demo.spec.ts --grep gallery
```

writes one screenshot per scenario in light and dark for each browser project.
