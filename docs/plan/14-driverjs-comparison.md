# 14. VirtualTour plan vs. driver.js (2026-11-12)

> **Status:** this comparison led, in two steps on the same day, to the current design.
> First the owner chose to build VirtualTour as a layer on a pinned driver.js 1.12.1 with
> upstream pull requests for the gaps; later the same day the owner chose to **fork**
> driver.js instead ("if we're using driver.js let's just fork it. We aren't waiting on
> anything"). The plan files `00`-`13` describe the fork. This file is kept as the record of
> the evidence. The "VirtualTour plan" column below describes the **first** plan (own engine),
> not the current one. Reading and changing driver.js source is now the core of the work
> (`13-licensing.md` §1).

**driver.js facts (CONFIRMED):** MIT (`license`, `packages/driver/package.json`); zero runtime dependencies (no `dependencies` key);
repo moved to `github.com/nilbuild/driver.js` (old `kamranahmedse/driver.js` redirects); 27k stars; 1 open issue (#428, JSX in
descriptions, open since 2023). Last release **1.12.1, Nov 11 2026 8:17 PM EST**, tag `1.12.1` = commit `0163642dc532417ea401684bd26690e2f3283d63`. Eight minor releases (1.5.0-1.12.0) since Jun 23 2026; four of them (1.9.0-1.12.0) came in the last six weeks. One maintainer. No `CONTRIBUTING` file, no CLA.
Size, gzip -9 of the shipped minified files: core JS **14.1 KB** + CSS 1.9 KB (plan budget: 15 KB core). Hints add 6.0 KB; checklists add 2.7 KB.
Source: about 5 500 lines of TypeScript under `packages/driver/src` (4 300 without hints and checklists), 7 100 lines of jsdom tests under `packages/driver/tests`, 7 500 lines of Playwright specs under `apps/playground/e2e`.
Evidence refs are `packages/driver/src/<file>:<line>@1.12.1` unless they are a `driverjs.com/docs/...` page.

| Area | VirtualTour plan | driver.js 1.12.1 (evidence) | Gap |
|---|---|---|---|
| Tour model, navigation | createTour, forward/backward/goTo/exit/finish, exit prompt, append/drop one step, global registry | drive/moveNext/movePrevious/moveTo/destroy/setSteps, isFirst/isLastStep (`types.ts:179-205`); exit confirm via `onDestroyStarted` (/docs/confirm-before-closing); no single-step add/remove, no registry | partial, CONFIRMED |
| Step content, buttons | title/body as string, array, Element or function; `label`; button list with actions, disabled, kind, attrs | title/description are HTML **strings only** (`types.ts:133-134`); Next/Prev/Close via `showButtons`/`disableButtons`; other buttons by DOM injection in `onPopoverRender` (/docs/custom-buttons); `updatePopover()` in place | partial, CONFIRMED |
| Targeting, wait, skip, conditional, async | waitFor, whenMissing, shouldShow, prepare(), autoAdvance | waitForElement, skipMissingElement, onElementMissing presets, advanceOn {event,when,strict}, advance(), action steps, nudge (`types.ts:19-98`; /docs/action-driven-tours). No `shouldShow`; async work goes in `onNextClick` then `moveNext()` (/docs/wait-for-a-save) | has most (more than plan on action steps), CONFIRMED |
| Positioning engine | own engine: side+align, flip, shift, offset, viewport padding, arrow, absolute or fixed, scroll-container boundary, RTL suite | side/align, falls back to another side, clamps to viewport, arrow (`popover/position.ts:57-140,261`). Boundary is the window only (`position.ts:66-75`); fixed only (`styles/popover.css:50` `position: fixed`); no RTL code in src | partial, CONFIRMED |
| Overlay, highlight | SVG cut-out, per-corner radius, extra highlights, cut-out clipped by scroll containers, block clicks, state classes, animation | SVG cut-out, `stagePadding`/`stageRadius` (one number), animation, `disableActiveInteraction` incl. `"clicks"`, `allowedElements` raised above overlay. Extra cut-outs only for allowed elements inside a `<dialog>` (`overlay/overlay.ts:103-113`). Cut-out uses the raw element rect, **not clipped** by scroll parents (`overlay.ts:44-61`, `overlay/stage.ts:38-49`). Scroll-into-view does handle scroll containers (`core/utils.ts:73-135`) | clipping missing, extras partial, CONFIRMED |
| Events, lifecycle | typed on/once/off emitter on tour and step, normative order, global relay | one callback per hook (onHighlightStarted, onHighlighted, onDeselected, onDestroyStarted, onDestroyed, button hooks) with end `reason` and AbortSignal (`types.ts:4-17,118-129`); no emitter, no multiple listeners | partial, CONFIRMED |
| Accessibility | dialog named by title or `label`; focus in, trap, restore; Esc/arrows skip editable fields; reduced motion everywhere; WCAG 2.2 AA audit | `role=dialog` + labelledby/describedby (`popover/popover.ts:267-268,374`); Tab trap over popover + target + allowed (`interaction/events.ts:43-66`); focus restore (`driver.ts:520-521`); keys skip text fields and ARIA widgets (changelog 1.11.0); live-region announcements (`popover/live-region.ts`); reduced motion in CSS (`styles/driver.css:118,207`). Gaps: an untitled step has **no accessible name** (`aria-labelledby` points at a hidden title, `popover.ts:192-195,268`); the JS cut-out animation ignores reduced motion (`tour/highlight.ts:185` checks only `animate`); no published WCAG audit found | partial (good base), CONFIRMED |
| Theming | base.css + theme.css, namespace prefix, CSS variables | driver.css, `popoverClass`, CSS variables, overlayColor/opacity (/docs/theming); fixed `driver-` prefix | has it, CONFIRMED |
| Framework wrappers | React and Vue packages | none; docs say none is needed and show useEffect/onBeforeUnmount (/docs/react-and-vue) | missing (low value), CONFIRMED |
| SSR | no DOM at import; gate test; clear error on server `start()` | no top-level `window`/`document` use found in src; docs say "keep it client-side"; no SSR test | INFERRED import-safe |
| JSON tours, persistence, counter | JSON schema v1 with named handlers, serialize; ProgressStore (localStorage/memory, skipCompleted, resume); counter | counter via `showProgress`/`progressText`. No schema; steps carry functions. Persistence is a recipe using `onDestroyed` reason + index (/docs/resume-a-tour, /docs/multi-page-tours) | counter has; JSON missing; persistence recipe only, CONFIRMED |
| Avatar + speech bubble | sprite player, packs, roles, idle loop, reduced motion, Thumbtack, classic-pack loader | nothing. But `onPopoverRender` runs **before** the popover is positioned (`popover.ts:303-305`), so an avatar added into the popover is placed by driver.js | missing, CONFIRMED |

**driver.js has, plan does not:** hints/beacons and checklists (separate entries, plan defers beacons); action steps and nudge; steps inside modal
`<dialog>`s (1.10.1-1.12.1 fixes; the plan never mentions `showModal`/top layer); following elements a framework re-renders (`core/context.ts:78-79`).

## What VirtualTour adds (ranked)
1. **Avatar + speech bubble** (A-01..08): the whole point of the PRD's "Clippy" angle. driver.js has nothing.
2. **Cut-out clipped by scroll containers, extra highlights, scroll-container boundary for the popover, RTL, absolute strategy.** These need driver.js **source changes** — which is why forking won over layering.
3. **Accessibility gaps:** a name for untitled steps, reduced motion in the JS animation, a WCAG 2.2 AA audit.
4. **JSON tour schema + persistence store**: built outside the engine.
5. **Typed emitter, global registry, per-step add/remove, Element/function content:** wrapped around the engine's hooks.
6. **React/Vue wrappers:** low value; driver.js shows they are not needed.

## What the first plan rebuilt that driver.js already ships
Navigation and lifecycle, the positioning engine (except the gaps above), the overlay/cut-out,
wait/skip/advance, the glide motion: about **24 of 52 tasks**, in a size class (14 KB) the plan only targets.

## Recommendation history
- **Layer on driver.js (MIT), pin the version** was the first recommendation: keep 13 tasks, thin 13, add 2-4 upstream PRs. Its weak point was waiting on a single upstream maintainer for the source changes in item 2, with a bundled-patch fallback as the only hedge.
- **Fork** was the recommendation's own escape hatch ("fork only if upstream rejects the clipping/boundary PRs; the fork costs the same as the layer plus tracking upstream yourself"). The owner chose it outright so nothing waits. The cost that stays is tracking upstream (`01-architecture.md` §12); the cost that goes away is every fallback mechanism and every contract test.
- **Build as planned (own engine)** only made sense if zero dependencies or the clean-room story were hard requirements; the fork has zero dependencies anyway, and MIT attribution replaces the clean-room story.
