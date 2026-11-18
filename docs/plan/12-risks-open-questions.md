# 12. Risks and open questions

---

## 1. Open questions for the project owner (top five first)

Most questions from the layered design were answered on 2026-11-12 (§2). What remains
are plan-level defaults the author chose that the owner may want to flip.

| # | Question | Why it matters | Plan's default until answered |
|---|---|---|---|
| 1 | **DECIDED (maintainer, 2026-11-13): fixed by default, `absolute` is an opt-in.** Default `position.strategy`: `'fixed'` or `'absolute'`? The PRD (P-6) says absolute is the default; the engine was built on `fixed` (`styles/popover.css:50`) and its whole positioning suite proves `fixed`. | Flipping the default changes every popover's containing block and would make the ported positioning specs the exception rather than the rule. | Decided: `'fixed'` (F-10). `absolute` is the opt-in for pages with transformed ancestors or scrolling mount containers; the docs say why. |
| 2 | **DECIDED (maintainer, 2026-11-13): remove.** Hints and checklists are removed from the fork (F-01), not kept unpublished. | Removing keeps the rename and namespace work small and the size report honest; keeping them means renaming and maintaining about 1 300 lines and 1 100 test lines nobody uses in v1. | Decided: removed in F-01; the upstream tag holds them; "hotspots and beacons" stays a later item (§4). |
| 3 | **DECIDED (maintainer, 2026-11-13): off.** Default `dim.lockScrollParent` is `false`: the page can scroll while a step is shown and the popover follows the highlighted element. | driver.js freezes the target's scroll parent while a step shows; the PRD wants the popover to follow scrolling ancestors instead. | Decided: `false` (F-09): follow, do not lock; `true` restores the old behavior per tour. |
| 4 | **DECIDED (maintainer, 2026-11-13): enough.** Popover-internal classes stay fixed (`vt-popover-*`); only classes added to page elements take the `namespace` prefix. This satisfies T-10. | Namespacing the popover classes too would require a per-namespace stylesheet (runtime `<style>` injection or a build step), which breaks strict CSP and static hosting. | Decided: fixed popover classes; multiple instances style their popovers through `classes` and CSS variables (`01-architecture.md` §5). |
| 5 | **Avatar `farewellMs` default 0 or 600?** | With 0 the `celebrate` role never plays on finish unless the integrator opts in. | Decided (maintainer, 2026-11-13: "whatever is easier for MVP"): 0 ms. The avatar is removed immediately when the tour ends; the `farewellMs` option is dropped from the MVP and listed under §4 as a later item. |

### More open questions (lower priority)

| # | Question | Default |
|---|---|---|
| 6 | Docs site tool: VitePress is suggested; any preference? | VitePress. |
| 7 | Should the React wrapper also ship a `<TourStep>` declarative component? | Provider plus hook only. |
| 8 | Should the avatar's `point.<dir>` choice consider the final flipped side only, or the vector to the target center (this plan)? | Vector. |
| 9 | Minimum browser versions: "last two" of each at the time of 1.0, or pinned versions in docs? | Pinned at 1.0 time in `docs/guide/browser-support.md`, noting the ES2020 target. |
| 10 | Who is the second copyright holder on `LICENSE`? | Decided (maintainer, 2026-11-13): "VirtualTour contributors". F-01 ships `Copyright (c) <year> VirtualTour contributors`. |

Answered by the owner on 2026-11-12 (recorded in §2): fork driver.js; keep all PRD items;
expose action steps; size is a soft target; no shadow roots or iframes in v1; Thumbtack
art license (CC0), who draws Thumbtack (code, permanently), the classic-pack docs page
(ships in release one with the lawyer review), the counter with skipped steps (accept),
arrow keys in RTL (physical).

---

## 2. Decisions already made (do not reopen without the owner)

- **VirtualTour is a fork of driver.js 1.12.1 (MIT)**, started from tag `1.12.1`, commit
  `0163642dc532417ea401684bd26690e2f3283d63`. The source lives in `src/engine/` and is
  changed directly. There is no upstream dependency and nothing waits for an upstream
  merge. Fixes may be offered upstream later as goodwill, never as a blocker. The MIT
  license and the original copyright notice are kept with ours alongside; `NOTICE.md`
  records the fork point. (Owner, 2026-11-12: "if we're using driver.js let's just fork
  it. We aren't waiting on anything.") This supersedes the layered design of the same day
  (pin, contract tests, bundled-mode fallback, upstream PR track), which is removed from the
  plan; git history has it.
- **Every PRD item is in scope; nothing is dropped.** The items the layered design had
  removed (absolute strategy P-6; mount containers T-6; namespace T-10; per-corner radius
  H-2; `flip`/`shift` off, cross-axis offset, arrow `minInset` P-2/P-4/P-5/P-9;
  `placement: 'auto'` P-1; `reveal: false` and native options SC-1) and the former upstream
  items (scroll-container clipping H-5; extra highlights H-3/H-4; boundary, padding, and
  `side: 'over'` P-3/A-3; RTL mirroring P-2; nested scroll containers P-7; accessible name
  X-1/S-3; reduced motion for the tween X-5/H-6) are direct engine changes
  (`06-tasks-M2-engine.md`, V-05). (Owner, 2026-11-12.)
- **Action steps are public API in v1**: `instruction`, `advanceDelay`, `autoAdvance.strict`,
  `tour.advance()`, `tour.nudge()`, `completed` events, JSON fields (V-06). (Owner,
  2026-11-12.)
- **Bundle size: about 21 KB min+gzip for the core entry is a soft target; larger is
  acceptable when needed.** CI keeps a size report that warns and never fails. (Owner,
  2026-11-12.)
- **Tours inside shadow roots or iframes are not in v1.** `mountIn` must be a light-DOM
  element of the current document; the engine throws otherwise (F-13). (Owner, 2026-11-12.)
- **Public API uses VirtualTour's own names; driver.js's public surface is not kept.**
  Engine internals keep driver.js's names for cheap cherry-picks. A migration page maps
  options and classes. (`01-architecture.md` §4.)
- **The avatar's bubble is built natively by the engine's popover renderer**
  (`layout: 'speaker'`), and the arrow is measured against the bubble in engine code; no
  MutationObserver or post-positioning fix-up (`02-avatar.md` §4).
- **Arrow keys in right-to-left pages: the Right arrow always means forward** (physical
  keys, `interaction/events.ts:99-103`). Owner, 2026-11-12. F-08 (RTL positioning) does not
  touch key handling.
- **The step counter counts every step in `tour.steps`, including steps that will be
  skipped** (`shouldShow`, `whenMissing: 'skip'`). Owner, 2026-11-12: accept and document
  for v1. The counter is the engine's `showProgress` text, whose total is `steps.length`
  (`tour/step.ts:66-70`); `progressInfo()` exposes the same index/total.
- **Thumbtack art is CC0 1.0** (no rights reserved, no credit needed), separate from the
  MIT license on the code. `LICENSE` stays MIT for the code; the art directory carries its
  own CC0 notice (`13-licensing.md` §7); the pack's `license` field says `CC0-1.0`. Owner,
  2026-11-12.
- **Thumbtack is drawn by code, permanently.** The character is generated from the
  parametric SVG description (`frames.mjs` → SVG frames → sheet, A-03). That pipeline is
  the final art approach for 1.0 and after; no illustrator pass. Owner, 2026-11-12.
- Avatar is a pluggable slot; the project ships Thumbtack; openclippy is not adopted
  (`13-licensing.md` §2).
- Clippy art is never redistributed; the docs explain self-hosted loading
  (`13-licensing.md` §5, §6).
- **The "Loading a classic paperclip (Clippy) avatar pack" docs page ships in release
  one**, with the warning block from `13-licensing.md` §5.3, and the lawyer review required
  by PRD §8 (V-17 checklist) covers that page's wording. Owner, 2026-11-12.
- Avatar format: sprite sheet + JSON animation map; v1 behavior is per-step animation,
  idle, reduced motion; no sound.
- From felixrieseberg/clippy nothing is copied except, optionally, the random idle picker
  with its MIT notice; the sprite player is written new.
- Stack: TypeScript, Vite library mode, Vitest (jsdom, as upstream), Playwright on four
  engines, ESM + types, SSR-safe import. driver.js's tsdown, turbo, pnpm, and Astro apps
  are not kept.
- v1 extras: persistence hooks, versioned JSON tour schema, built-in counter. Later:
  analytics adapter, hotspots/beacons, route awareness.
- Fully generic library: no company, product, board, or ticket names. driver.js is named
  because the code derives from it.
- Repository, repository name, hosting, CI publishing, npm organization: out of scope.
- Working name "VirtualTour" in plan text only.

---

## 3. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Fork maintenance burden.** About 4 300 lines of engine code and 12 000 lines of ported tests are now ours to keep working; every browser change or bug report lands here, not upstream. | A small team carries a positioning engine, an overlay, focus handling, and `<dialog>` layering forever. | The ported suites (F-02) make regressions visible; engine files import nothing from outside `src/engine/` so the engine stays a unit; the per-file change table in `UPSTREAM.md` shows where we diverged; cherry-picks stay a path rewrite (`01-architecture.md` §12). |
| **Losing upstream fixes.** driver.js releases often (eight minor releases between 2026-06-23 and 2026-11-11); fixes to code we still share will keep coming and the fork does not get them automatically. | Known bugs fixed upstream stay in the fork unnoticed. | Quarterly (and per-release) review recorded in `UPSTREAM.md` (V-16); `tools/upstream-apply.mjs` makes a shared-code fix a ten-minute job; the first review is a task deliverable, not a wish. |
| **Divergence makes cherry-picks fail.** `position.ts` and `overlay.ts` are rewritten heavily by M2; upstream hunks there will conflict. | Fixes in those files need hand ports. | Expected and accepted: those files implement PRD behavior upstream does not have. The per-file table tells the reviewer in advance; hand-port only security or correctness fixes. |
| **Size grows past the soft target.** Engine features (boundary, RTL, strategy, corners, clipping) plus the public layer could reach 24-25 KB. | Larger bundle than the PRD's 15 KB. | Owner accepted a soft target; the report warns, and a PR explains growth above 10 %. `hints`/`checklist` removal already saves about 9 KB versus a full driver.js. |
| **The rename pass (F-03) breaks ported tests in subtle ways** (a class string in a selector the search-and-replace missed). | A ported test passes against the wrong element or is skipped. | The grep gate (`driver-` empty under `src/`), a reviewed diff of the test rename, and the rule that no ported assertion is weakened. |
| **Engine behavior changes behind the public API are easy to make by accident** (a one-line change in `highlight.ts` alters hook order). | The public event order (§7.2) drifts. | `test/engine/invariants.test.ts` (V-03) and the §7.2 recorder tests fail first; a PR that touches `src/engine/` runs the whole engine suite (gate 3). |
| **Fixed popover classes vs namespaced state classes confuses integrators** (T-10 expectation that "everything" is prefixed). | Support questions; a second instance's custom popover CSS collides. | Documented in `guide/styling.md` and the multiple-tours cookbook; decided by maintainer on 2026-11-13 (open question #4). |
| **`strategy: 'absolute'` with `mountIn` that scrolls.** Coordinates must include the container's scroll offsets and the overlay stays `fixed`, which can look wrong inside a scrolling container. | A visually detached overlay in that one configuration. | F-10 and F-13 document the pairing; the e2e covers a transformed container; a scrolling `mountIn` with an overlay is called out as unsupported in `guide/containers.md`. |
| **Capture-phase scroll listener fires often** (F-09) on pages with many scrollers. | Extra `refresh()` scheduling; the rAF coalescing keeps it to one per frame. | `e2e/perf.spec.ts` (V-17) tripwire; the listener does nothing when nothing is active. |
| **Engine global CSS side effects.** Under `dim: true` everything outside the target is non-interactive and the popover has `z-index: 1000000000`; fixed ids mean one popover per page. | Surprises for integrators (a nested scroller cannot wheel-scroll; an app modal above the popover is impossible); two tours cannot coexist (N-10, by design). | Documented in `guide/overlay.md` and `guide/how-it-works.md`; `dim: false` restores pointer events; `lockScrollParent` is off by default. |
| **Keyboard handling on `keyup`.** The engine acts on `keyup`; an app that handles `keydown` and prevents default is honored, but an app that only stops propagation on `keyup` is not. | Escape leaks into or out of the tour in some apps. | Documented; `keys.escape: false` is available; changing it is an engine task if a real integrator needs it. |
| **`dock: 'auto'` reflow loop.** Changing the dock after positioning changes the box, so the presenter calls `refresh()` once. | A loop if the dock flips back. | One-shot flag per step; the second evaluation keeps the chosen dock. |
| **jsdom differences from real browsers** hide bugs in DOM units. | False confidence. | Every DOM behavior that matters has a real-browser e2e; units cover logic, not layout. jsdom was chosen because upstream tests on it. |
| **Thumbtack reads as a Clippy copy** if the drawing drifts toward a paperclip. | Legal exposure; undermines the clean position. | `13-licensing.md` §4 line; A-03 review; the character is a pin, not a clip. |
| **Accidental Clippy art check-in.** | Project redistributes Microsoft art. | Art tripwire tests (A-07, V-15, V-17) on the repository and the tarball; synthetic test packs only. |
| **`innerHTML` bodies** used with untrusted content by integrators (the engine sets HTML, `popover.ts:73-80`). | XSS in integrators' apps. | Documented warning (S-2), `sanitize` hook runs before the engine sees the string (V-05, V-06), cookbook page (V-14). |
| **Wrapper lifecycle bugs** (React strict-mode double effects, Vue HMR). | Tours start twice or leak. | Provider creates the tour once and disposes on unmount; tests for strict mode double invocation (V-13). |
| **Edge channel missing on test machines.** | Edge coverage silently absent. | The `edge` project reports "skipped" loudly; V-17 checklist requires one full four-engine run. |
| **JSON tour strictness** rejects fields from future versions. | Forward compatibility pain. | `format` is versioned; a `/2` parser can accept `/1` documents; strictness catches typos today. |
| **Persistence id instability** (auto ids include random suffixes). | Progress never found. | Docs and dev warning when `progress` is set without an explicit `id`. |

---

## 4. Later (explicitly out of v1)

- Analytics adapter interface (events → Segment, PostHog, ...). The event API plus `meta`
  already carry what an adapter needs; a `./analytics` entry can be added without core
  changes.
- Hotspots and beacons: upstream's hints entry (about 6 KB) can be restored from the fork
  point tag and renamed; a thin wrapper entry is the obvious v1.1.
- Route awareness (steps that span navigations in single-page apps); persistence hooks plus
  `resume` cover the simplest case already.
- Tours inside shadow roots or iframes (`mountIn` across document boundaries).
- Avatar farewell animation: an optional `farewellMs` delay on finish so `celebrate` can play (MVP removes the avatar immediately).
- `<TourStep>` declarative components; sound in avatar packs; multiple avatars per tour.
