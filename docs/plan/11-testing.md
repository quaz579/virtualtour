# 11. Testing

This file is the test contract. Task files name their tests; this file says how those
tests are organized, which browsers run them, which fixtures exist, and which gates must
pass on every PR.

Two rules that follow from the fork:

1. **The ported driver.js suites are the engine's safety net.** `test/engine/**` (jsdom)
   and `e2e/engine/**` (Playwright) start as copies of upstream's suites (F-02) and grow
   with every engine task. An engine change that breaks a ported test is either a bug or a
   deliberate behavior change that the PR names and updates the test for. Never weaken an
   assertion silently.
2. **The engine is never mocked.** Public-layer unit tests that touch the popover, overlay,
   or hooks run the real `createEngine()` in jsdom.

---

## 1. Layers

| Layer | Tool | Environment | What it proves |
|---|---|---|---|
| Pure unit | Vitest, `unit-node` project | no DOM globals | config merge, compiler, emitter, JSON parsing, pack validation, classic converters, dedupe, upstream-apply rewriting |
| Engine unit (ported + new) | Vitest, `unit-dom` project (jsdom), `test/engine/**` | real engine | upstream behavior at the fork point, every F-task change, the 11 invariants (`01-architecture.md` §3.2) |
| Public DOM unit | Vitest, `unit-dom` (jsdom) | real engine, fake timers where needed | lifecycle ordering, navigator, presenter parts, attribute guards, state classes, persistence stores, speaker structure, idle scheduler |
| SSR gate | Vitest, `unit-node` | `window`/`document` deleted | every entry and the engine import on the server; `createTour({})` works |
| Engine e2e (ported + new) | Playwright, `e2e/engine/**` | the bare fixture page `demo/e2e.html` (and `demo/e2e-rtl.html`) | positioning, flip, arrow geometry, scroll following, `<dialog>` layering, focus trapping, keyboard, pointer gate, action steps, every F-task behavior |
| Public e2e | Playwright, `e2e/*.spec.ts` | `demo/fixtures/*.html` | layout, scrolling, pointer events, focus, keyboard, reduced motion, animations, storage, wrappers, avatar through the public API |
| Size report | `tools/size-report.mjs` | Node | sizes vs soft targets, warn-only |
| Accessibility | Playwright + an accessibility engine (dev dependency) | the four browsers | zero violations on representative steps, dialog and avatar modes |
| Art tripwire | Vitest | Node | no third-party character art in the repository or the tarball |
| Fork-point check | Vitest | Node | `src/engine/**` hashes match `test/fixtures/fork-point.sha256` (updated deliberately by engine tasks) |

Unit tests mirror `src/` under `test/` (`test/navigator.test.ts`, `test/avatar/speaker.test.ts`,
and so on). Pure tests use the `.node.test.ts` suffix so the node project picks them up.
Ported engine tests keep upstream's file names under `test/engine/` and `e2e/engine/`.

---

## 2. Browser matrix

`playwright.config.ts` projects:

| Project | Engine | Notes |
|---|---|---|
| `chromium` | bundled Chromium | always on |
| `edge` | `channel: 'msedge'` | on when installed; skipped (not failed) otherwise; covers D-7's Edge |
| `firefox` | bundled Firefox | always on |
| `webkit` | bundled WebKit | stands in for Safari (D-7); known differences noted per spec |

Upstream ran chromium, firefox, webkit (`apps/playground/playwright.config.ts`); the ported
specs inherit that and gain the optional edge run.

Per-test options (not per project): `page.emulateMedia({ reducedMotion, colorScheme })`,
`locale`, and RTL by loading the RTL fixture page. Default viewport 1280x800; a `mobile`
describe block in `avatar-layout.spec.ts` uses 390x844 with `isMobile: true` (chromium and
webkit only).

Browser tests run against the `demo/` Vite app served by Playwright's `webServer`. Engine
specs load `demo/e2e.html` and build their tour in the page through `window.__engine`
(the port of upstream's `window.driverjs`). Public specs load one fixture page from
`demo/fixtures/` and drive the tour through `page.evaluate` against `window.__tour`.

---

## 3. Fixtures

| Fixture | Used by | Contents |
|---|---|---|
| `demo/e2e.html` | all `e2e/engine/**` | the upstream fixture page's element set (`#heading`, `#intro`, `#one/#two/#three`, `#field`, `#hover`, `#side`, `#outside`, `#slot`, `#spacer`, `#far`) plus, added by F tasks: a 200 px scroller with a half-visible item (F-04), an allowed button outside any dialog (F-05), a fixed header and a nested scroller (F-06), a transformed `#app` container and a `#dim` container (F-10, F-13) |
| `demo/e2e-rtl.html` | F-08 | the same page with `dir="rtl"` |
| `demo/fixtures/navigation.html` | V-03 | plain page, start button with `tabindex`, three steps with targets, an exit prompt toggle |
| `late-target.html`, `skip.html`, `prepare.html`, `auto-advance.html` | V-04 | delayed insertion, toggleable targets, a panel opened by `prepare`, a real Save button whose handler calls `stopPropagation`, an input |
| `content.html` | V-05, V-09 | title/Element body/custom buttons/close attrs; an untitled labeled step; inputs on the page |
| `action-steps.html` | V-06 | a gated step with a real target, an `advanceDelay` |
| `overlay.html` | V-07 | targets with click counters, extras, nested extras, a half-visible list item in a 200 px scroller, a page button outside the tour, a per-corner radius step |
| `theme.html` | V-08 | theme toggles, dark mode, focus ring |
| `persist.html` | V-10 | tour with a stable id, reload-safe |
| `motion.html` | V-12 | glide and progress bar |
| `avatar-player.html`, `avatar-layout.html` (includes an open `<dialog>` case and an RTL variant), `avatar-steps.html`, `avatar-fallback.html` | A-* | synthetic pack and Thumbtack |
| `demo/react/`, `demo/vue/` | V-13 | wrapper demos |

`e2e/fixtures/test-pack/` is generated by `tools/make-test-pack.mjs` (synthetic colored
frames, three map formats). It is committed so tests do not depend on the generator at
runtime; the generator test asserts the committed output is current.

---

## 4. What each real-browser suite must cover

| Suite | Chromium | Edge | Firefox | WebKit | RTL | Scroll containers | `<dialog>` | Reduced motion |
|---|---|---|---|---|---|---|---|---|
| engine (ported: tour, keyboard, focus, overlay, popover-position, scroll, dialog, advance-on, action-driven, instruction, …) | x | x | x | x | | x | x | x |
| engine (new: overlay-clip, allowed-cutout, popover-boundary, placement, rtl, arrow, scroll, strategy, reveal, stage-radius, mount-in, animation, speaker-arrow) | x | x | x | x | x | x | x | x |
| navigation, keyboard, exit prompt | x | x | x | x | | | | |
| eligibility (wait, skip, prepare, auto-advance) | x | x | x | x | | | | |
| content, configure, counter, action steps | x | x | x | x | | | | x |
| overlay (click-through, dim, extras, lock, clipping, radius, reduced motion, dim:false) | x | x | x | x | | x | | x |
| theme, a11y audit | x | x | x | x | | | | x |
| persistence | x | x | x | x | | | | |
| motion (glide, progress) | x | x | x | x | | | | x |
| avatar (player, layout, steps, motion, classic, fallback, a11y) | x | x | x | x | x | | x | x |
| wrappers | x | x | x | x | | | | |

Positioning, flip, arrow geometry, scroll following, `<dialog>` layering, and focus trapping
are engine code and are covered by the engine suites. The public suites assert each once
as a smoke check through the public API (the popover is next to its target; it moves with
`window.scrollBy`). Avatar mode re-asserts geometry because the speaker changes the
measured box.

---

## 5. Assertion conventions

- Geometry assertions use `getBoundingClientRect` read inside one `page.evaluate` after
  `await new Promise(requestAnimationFrame)` so reads happen after the engine's refresh
  frame (upstream's `settle()` helper does two frames; keep it).
- "Within 1 px" means `Math.abs(a - b) <= 1`; 2 px where zoom is involved; the ported
  `near()` helper uses `< 2` and stays as is.
- Click-through is proven with `document.elementFromPoint` plus a real `page.mouse.click`
  on a counter element, never only by inspecting CSS.
- Reduced motion is proven by observing no change over time (sampling), by
  `document.getAnimations()` being empty, and by `<body>` carrying `vt-simple`.
- Promise semantics (N-1, N-4) are proven by awaiting the method inside `page.evaluate` and
  reading the DOM in the same evaluation.
- Event ordering is proven in unit tests with a recorder that appends
  `"<source>:<event>"` strings and compares whole arrays to the expected sequence named
  after the row in `01-architecture.md` §7.2.
- Accessible names are asserted with `page.getByRole('dialog', { name })`.
- Screenshots are attached as artifacts for human review; they are not pixel-diffed in v1,
  except the explicit pixel samples in F-05 and F-12.

---

## 6. Gates on every PR

1. `npm run typecheck` (strict) for every package and `docs/snippets`.
2. `npm test` (both Vitest projects) including the ported engine suite, the invariants,
   the SSR gate, the fork-point check, and the art tripwire.
3. `npm run e2e` on chromium, firefox, webkit (edge when available). A task's listed specs
   must be included; the ported engine specs run on every PR that touches `src/engine/`;
   the whole suite runs on milestone-closing tasks (F-03, V-06, V-09, A-08, V-12, V-17).
4. `node tools/size-report.mjs` runs and its output is pasted into the PR description. It
   never fails the build; a PR that grows an entry by more than 10 % explains why.
5. A PR that touches `src/engine/` updates `test/fixtures/fork-point.sha256` and lists the
   changed engine files in its description (so `UPSTREAM.md`'s per-file table can be kept
   current).
6. Lint for banned words in prose files (`docs/**`, `*.md`, TSDoc): a small script fails on
   a maintainer-supplied list (company, product, and ticket-prefix names) so the library
   stays generic. "driver.js", its repository URL, and its author's copyright line are on
   the allow list.
7. `grep -r "driver-" src/` is empty after F-03.

---

## 7. Test data and determinism

- Random ids use an injectable RNG (`config.ts` exports `setRandomSource` for tests).
- Idle animation choice uses an injectable RNG (`idle.ts`).
- Time: unit tests use Vitest fake timers and a controllable rAF stub (`test/helpers/raf.ts`)
  that advances a virtual clock. The engine's transition uses `requestAnimationFrame`
  and `Date.now()` (`tour/highlight.ts:121,174`), so unit tests set `animate: false` unless
  the test is about the transition, in which case the rAF stub and `vi.setSystemTime`
  drive it. The ported suite's `nextFrame()`/`tick()` helpers stay.
- e2e tests use real time with polling (`expect.poll`) and generous timeouts.
- `localStorage` is cleared in `beforeEach` of the persist spec.
- Fonts: fixtures use `font-family: system-ui` and avoid text-width assertions.

---

## 8. Manual checks recorded per milestone (not automated)

- V-09 and A-08: one screen-reader pass (VoiceOver on macOS or NVDA on Windows) through a
  4-step tour in dialog and avatar modes; expected announcements listed in
  `docs/guide/accessibility.md`.
- V-14: visual review of the screenshot gallery in light and dark.
- A-03: visual review of the Thumbtack contact sheet (legibility at 96 px and 64 px).
- V-16 and every later upstream review: the changelog read is recorded in `UPSTREAM.md`.
