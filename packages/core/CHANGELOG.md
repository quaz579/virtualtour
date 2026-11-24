# Changelog

## [1.0.2](https://github.com/quaz579/virtualtour/compare/v1.0.1...v1.0.2) (2026-11-24)

### Bug Fixes

* **demo:** ship the Thumbtack avatar pack with the Pages build ([#73](https://github.com/quaz579/virtualtour/issues/73)) ([9c0f845](https://github.com/quaz579/virtualtour/commit/9c0f845728b30621d83c664c52330fc85a3e107d))

## [1.0.1](https://github.com/quaz579/virtualtour/compare/v1.0.0...v1.0.1) (2026-11-24)

### Bug Fixes

* publish via npm trusted publishing ([#76](https://github.com/quaz579/virtualtour/issues/76)) ([8fb1660](https://github.com/quaz579/virtualtour/commit/8fb16603612f03f2b9022e4802482116ce8c7db2))

## 1.0.0 (2026-11-24)

### Features

* absolute position strategy for transformed containers (WU-29) ([#32](https://github.com/quaz579/virtualtour/issues/32)) ([2549ea1](https://github.com/quaz579/virtualtour/commit/2549ea17c3856ed55bea13a98b1e3ca5890a5e66))
* accessibility audit for dialog mode (WU-36) ([#40](https://github.com/quaz579/virtualtour/issues/40)) ([f35b0d5](https://github.com/quaz579/virtualtour/commit/f35b0d591240d1922aaa1d4227f77b1d7ce9339f))
* accessible name, content rendering and sanitizer (WU-14) ([#20](https://github.com/quaz579/virtualtour/issues/20)) ([33dcc23](https://github.com/quaz579/virtualtour/commit/33dcc238692053d84fc90d7a27032b869fb4ac50))
* action steps in the public API (WU-27) ([#31](https://github.com/quaz579/virtualtour/issues/31)) ([c546d61](https://github.com/quaz579/virtualtour/commit/c546d611c4d327d7b1e1c66143aa5033a2c6d069))
* add GitHub Pages demo site ([#72](https://github.com/quaz579/virtualtour/issues/72)) ([41f8d83](https://github.com/quaz579/virtualtour/commit/41f8d83dfbb27a697516f0ef158d80de7ba6a8f2))
* add sprite player and shared frame scheduler (WU-24) ([#27](https://github.com/quaz579/virtualtour/issues/27)) ([c1b0b4b](https://github.com/quaz579/virtualtour/commit/c1b0b4b82543ebed8386e6131051c3ebf0c14fa4))
* avatar idle loop and reduced motion end to end (WU-41) ([#45](https://github.com/quaz579/virtualtour/issues/45)) ([9f9ae8a](https://github.com/quaz579/virtualtour/commit/9f9ae8a624eadd27e1fa2e1c7fb1c34a20983a67))
* avatar pack types, validation, normalization and preload (WU-07) ([#6](https://github.com/quaz579/virtualtour/issues/6)) ([21172dc](https://github.com/quaz579/virtualtour/commit/21172dc25013d34728386541246c08bcdd05bb87))
* clip the overlay cut-out by scroll containers (WU-15) ([#18](https://github.com/quaz579/virtualtour/issues/18)) ([79ef080](https://github.com/quaz579/virtualtour/commit/79ef080e3f56641689833ac45512f5e745197cde))
* config model, deep merge, ids, emitter, tour compiler (WU-06) ([#7](https://github.com/quaz579/virtualtour/issues/7)) ([a1c0f7f](https://github.com/quaz579/virtualtour/commit/a1c0f7f5df9f8611f5ab069884f1c14a8dadae2b))
* consolidated demo with scenario picker and gallery (WU-45) ([#50](https://github.com/quaz579/virtualtour/issues/50)) ([8c1bd31](https://github.com/quaz579/virtualtour/commit/8c1bd31241bd59c159c0f6ca02a39e6112674449))
* **core,motion:** steps-changed event, progressVars refresh, composable glide ([#60](https://github.com/quaz579/virtualtour/issues/60)) ([c78ef56](https://github.com/quaz579/virtualtour/commit/c78ef5685d54167a77c26e82908771ab87686d83))
* cross-axis offset, RTL mirroring, arrow off and minimum inset (WU-33) ([#36](https://github.com/quaz579/virtualtour/issues/36)) ([2bbad7c](https://github.com/quaz579/virtualtour/commit/2bbad7c471877b924106ca30de80fd7997910c51))
* custom footer buttons, configure(), progressInfo and first-button focus (WU-20) ([#25](https://github.com/quaz579/virtualtour/issues/25)) ([0482bba](https://github.com/quaz579/virtualtour/commit/0482bba512268b553026ca907d5a9325764fccd6))
* cut out extra allowed elements anywhere, deduped and scroll-clipped (WU-21) ([#24](https://github.com/quaz579/virtualtour/issues/24)) ([338463e](https://github.com/quaz579/virtualtour/commit/338463e4bdbc9e4988e517180a177d1d5211497a))
* eligibility loop with waitFor, whenMissing, prepare, revealWith and auto-advance ([#19](https://github.com/quaz579/virtualtour/issues/19)) ([94b18ce](https://github.com/quaz579/virtualtour/commit/94b18ce32eba8c78269387eb1fd366150fa78690))
* engine seams for the public API (WU-08) ([#9](https://github.com/quaz579/virtualtour/issues/9)) ([5b1eff2](https://github.com/quaz579/virtualtour/commit/5b1eff282007f8b5594200774a828fa902e5cb69))
* harden avatar loading and fallback paths (WU-43) ([#48](https://github.com/quaz579/virtualtour/issues/48)) ([361dbc2](https://github.com/quaz579/virtualtour/commit/361dbc2c87d04138b5f180440eebdc5e5d3574b4))
* honor prefers-reduced-motion in the engine (WU-19) ([#16](https://github.com/quaz579/virtualtour/issues/16)) ([af7a716](https://github.com/quaz579/virtualtour/commit/af7a71644f92238444def9da13357713f06bea6d))
* import driver.js and build it with Vite (WU-01) ([#1](https://github.com/quaz579/virtualtour/issues/1)) ([0173625](https://github.com/quaz579/virtualtour/commit/017362566951f33423cb533839876e7aa234ed23))
* JSON tours with parse, serialize and schema files (WU-38) ([#41](https://github.com/quaz579/virtualtour/issues/41)) ([68d7ada](https://github.com/quaz579/virtualtour/commit/68d7adaed47f7bdcc3551a9867c0ece076adfe5c))
* motion add-on with glide and progress variables (WU-37) ([#39](https://github.com/quaz579/virtualtour/issues/39)) ([1d73850](https://github.com/quaz579/virtualtour/commit/1d7385001ec6b9a0c74f8e30a6399b8147fd68c0))
* mountIn and dimMountIn containers (WU-18) ([#15](https://github.com/quaz579/virtualtour/issues/15)) ([0d3bef4](https://github.com/quaz579/virtualtour/commit/0d3bef483a12af1053753755d4a6926ed1267285))
* nested scroll following and optional scroll-parent lock (WU-16) ([#17](https://github.com/quaz579/virtualtour/issues/17)) ([b16e3f5](https://github.com/quaz579/virtualtour/commit/b16e3f509aaae368221a73c54153aa632aa60f26))
* pack loaders for v1, classic formats and Thumbtack (WU-42) ([#44](https://github.com/quaz579/virtualtour/issues/44)) ([3c47594](https://github.com/quaz579/virtualtour/commit/3c47594f3720d8f9e30f1cb016629b3fa41559c0))
* per-corner cut-out radius (WU-17) ([#14](https://github.com/quaz579/virtualtour/issues/14)) ([6b16afd](https://github.com/quaz579/virtualtour/commit/6b16afd851f130353583f3e31a99fad6b21f8dd7))
* placement auto, flip/shift switches, position boundary and fallback fixes (WU-28) ([#30](https://github.com/quaz579/virtualtour/issues/30)) ([2af576d](https://github.com/quaz579/virtualtour/commit/2af576dc6b2aef74528251a024f759e459935280))
* popover boundary, padding and side over for targets (WU-22) ([#26](https://github.com/quaz579/virtualtour/issues/26)) ([447e9c2](https://github.com/quaz579/virtualtour/commit/447e9c27ad94689f456acc69c7d462ed3c07c1b9))
* progress persistence with localStorage and memory stores (WU-25) ([#28](https://github.com/quaz579/virtualtour/issues/28)) ([05b58ba](https://github.com/quaz579/virtualtour/commit/05b58ba4cd337e72b0b0040d6e683a57be9dcd46))
* React provider and useTour hook (WU-31) ([#34](https://github.com/quaz579/virtualtour/issues/34)) ([c8b8314](https://github.com/quaz579/virtualtour/commit/c8b83141d2ae23a4e569e374bfac60b60bf6501f))
* redraw Thumbtack avatar as a classic push pin ([#70](https://github.com/quaz579/virtualtour/issues/70)) ([355268f](https://github.com/quaz579/virtualtour/commit/355268fe36388e2a0aa35fb7682348108f42a2fc))
* release readiness, API freeze, perf tripwire and upstream re-check (WU-46) ([#52](https://github.com/quaz579/virtualtour/issues/52)) ([c0426f0](https://github.com/quaz579/virtualtour/commit/c0426f0150f243a79f5d66ea15d430d2acd2ed43))
* reveal options and reduced-motion-safe scrolling (WU-23) ([#23](https://github.com/quaz579/virtualtour/issues/23)) ([7d5703b](https://github.com/quaz579/virtualtour/commit/7d5703b47fd9d281e4d5ce93c9f3c85ef27047c0))
* speaker layout in the engine with bubble-measured arrow (WU-35) ([#38](https://github.com/quaz579/virtualtour/issues/38)) ([791c30f](https://github.com/quaz579/virtualtour/commit/791c30f2d34de499a6a277736aedd3f982ff4d3e))
* speaker presenter and avatar stylesheet (WU-39) ([#42](https://github.com/quaz579/virtualtour/issues/42)) ([f67ddc1](https://github.com/quaz579/virtualtour/commit/f67ddc1ad0d114312724477bfb46203b2989bce1))
* spotlight state classes, extras dedupe and overlay e2e (WU-30) ([#33](https://github.com/quaz579/virtualtour/issues/33)) ([efaab1a](https://github.com/quaz579/virtualtour/commit/efaab1a0e82cd317b811f598626a85a24909e207))
* step.configure treats null as clear-to-default ([#62](https://github.com/quaz579/virtualtour/issues/62)) ([e7d9940](https://github.com/quaz579/virtualtour/commit/e7d9940e11c2fa82b8cfe876fa906ec9c8890783))
* test harnesses, demo fixture, build/SSR/fork-point gates, size report (WU-02) ([#2](https://github.com/quaz579/virtualtour/issues/2)) ([5b3cd7b](https://github.com/quaz579/virtualtour/commit/5b3cd7b19442f5a0b60ddeda7fd52aa5a0cae565))
* theme stylesheet, dark mode, class contract and missing-stylesheet warning (WU-34) ([#37](https://github.com/quaz579/virtualtour/issues/37)) ([d765c79](https://github.com/quaz579/virtualtour/commit/d765c790ec7e21e97b235ba1d652aab01a321ac2))
* Thumbtack character, pack build and CC0 art license (WU-09) ([#10](https://github.com/quaz579/virtualtour/issues/10)) ([49ae09e](https://github.com/quaz579/virtualtour/commit/49ae09efceb69c37d2dc8bb5e19dc55c14e6d3d2))
* tour lifecycle, event ordering, exit prompt and engine invariants (WU-12) ([#13](https://github.com/quaz579/virtualtour/issues/13)) ([30e6828](https://github.com/quaz579/virtualtour/commit/30e682830f2f82359e09f9d197ac70a3b4fc5e6f))
* tour model, registry and dialog presenter skeleton (WU-11) ([#12](https://github.com/quaz579/virtualtour/issues/12)) ([e1c7726](https://github.com/quaz579/virtualtour/commit/e1c772658e6a2d3bb347c04265e1b66e1b1ad686))
* upstream tracking tool, review log and first review (WU-26) ([#29](https://github.com/quaz579/virtualtour/issues/29)) ([c3e4508](https://github.com/quaz579/virtualtour/commit/c3e450805d8becce1661d47c9f71584752e6b5b7))
* Vue provider and useTour composable (WU-32) ([#35](https://github.com/quaz579/virtualtour/issues/35)) ([a8d7701](https://github.com/quaz579/virtualtour/commit/a8d77018fb902998042307e4d5c95cac7e354746))
* withAvatar and per-step animation selection (WU-40) ([#43](https://github.com/quaz579/virtualtour/issues/43)) ([b61f28f](https://github.com/quaz579/virtualtour/commit/b61f28f5e0e121dc782019ab0fcc7161b7f6659e))

### Bug Fixes

* a dropped move target exits with reason api and never shows an earlier step ([#59](https://github.com/quaz579/virtualtour/issues/59)) ([4138b8e](https://github.com/quaz579/virtualtour/commit/4138b8ebdc9c82bebb881c19603f1523efec6371))
* a11y, theme and avatar follow-ups ([#54](https://github.com/quaz579/virtualtour/issues/54)) ([c85358f](https://github.com/quaz579/virtualtour/commit/c85358ff39d6561b404bf9192082ae8834d97f9b))
* **avatar:** idle edge cases and single last-idle memory ([#64](https://github.com/quaz579/virtualtour/issues/64)) ([7051f54](https://github.com/quaz579/virtualtour/commit/7051f54250fe01f4125647d41996f346f6bcfe8e))
* bound each progress save, keep late-load merge consistent, reject bad waitBudget ([#61](https://github.com/quaz579/virtualtour/issues/61)) ([a8d8ef4](https://github.com/quaz579/virtualtour/commit/a8d8ef4452270817650399af40107900d66fe83c))
* bound progress store load and warn on a stale resume step ([#57](https://github.com/quaz579/virtualtour/issues/57)) ([2b90f03](https://github.com/quaz579/virtualtour/commit/2b90f03ee7bc120530501363723a2ef4c303095f))
* **engine:** popover adopts the target's direction; verify physicalAlign in RTL ([#65](https://github.com/quaz579/virtualtour/issues/65)) ([a8f2bfd](https://github.com/quaz579/virtualtour/commit/a8f2bfde1dbcadbc6a005b4a8eabe90eed20f13d))
* harden navigator hooks, wait budget, auto-advance and centered steps (WU-13b) ([#21](https://github.com/quaz579/virtualtour/issues/21)) ([295ebe1](https://github.com/quaz579/virtualtour/commit/295ebe1af99d74ea5b8974f517c7581c9eb32558))
* **motion:** glide starts when the next popover renders, so it never shows at its final position first ([#63](https://github.com/quaz579/virtualtour/issues/63)) ([2cc9886](https://github.com/quaz579/virtualtour/commit/2cc988626c477543d28d031c8d5b7bd52baa8919))
* **react,vue:** currentStep changes only when a step is shown ([#67](https://github.com/quaz579/virtualtour/issues/67)) ([0a10468](https://github.com/quaz579/virtualtour/commit/0a10468faa5a220d97b5083f09823591d89f7908))
* **react,vue:** keep currentStep in sync when the step on screen is dropped ([#56](https://github.com/quaz579/virtualtour/issues/56)) ([5c96586](https://github.com/quaz579/virtualtour/commit/5c965863afcb37021c41223dad0fc8365102b4a4))
* reject colons in localStorage prefixes, survive throwing sanitize and counter hooks, add spotlit to names() ([#58](https://github.com/quaz579/virtualtour/issues/58)) ([1df60fc](https://github.com/quaz579/virtualtour/commit/1df60fc1b49b7e619e627ef59383962e926fe6de))
* rename npm packages to virtual-site-tour ([#75](https://github.com/quaz579/virtualtour/issues/75)) ([1d26e6b](https://github.com/quaz579/virtualtour/commit/1d26e6be2930ddf419e6e27afcab2dad5569d3c0))
* sanitize every popover HTML sink and keep user element bodies intact (WU-14b) ([#22](https://github.com/quaz579/virtualtour/issues/22)) ([5a9effd](https://github.com/quaz579/virtualtour/commit/5a9effd326fa0dcc46d80cbadec4d2b8120631c5))
* ship self-contained type declarations for every entry point ([#46](https://github.com/quaz579/virtualtour/issues/46)) ([a5931e2](https://github.com/quaz579/virtualtour/commit/a5931e2a31f6c891efe49ef56ba6b8d28da199fd))
* **vue:** currentStep is null when step-shown reports a dropped step ([#68](https://github.com/quaz579/virtualtour/issues/68)) ([ed6e8ab](https://github.com/quaz579/virtualtour/commit/ed6e8ab101467fca5ab8f0039bf7b183cdc9215d))

### Performance Improvements

* minify whitespace in shipped bundles and refresh size targets ([#49](https://github.com/quaz579/virtualtour/issues/49)) ([967f5fa](https://github.com/quaz579/virtualtour/commit/967f5fa998edc03047dcedb8ee77add1184887fc))

## 1.0.0 (2026-11-20)

First release. The tour engine is derived from driver.js 1.12.1 (tag `1.12.1`, commit `0163642dc532417ea401684bd26690e2f3283d63`, MIT). See `NOTICE.md` for the license and the files not carried over, and `UPSTREAM.md` in the repository for how later upstream changes are tracked.

### Public API

- `createTour`, `Tour`, `TourStep`: declarative tours with typed events, navigation, eligibility (conditional steps, waits, skip, prepare, reveal, auto-advance), action steps, persistence and resume.
- `parseTourJson` and `serializeTour`, with `schemas/tour.v1.schema.json`.
- `virtualtour/avatar`: `withAvatar`, `SpeakerPresenter`, pack loaders and validation, Thumbtack (CC0). `virtualtour/motion`: `glide`, `progressVars`.
- Stylesheets: `base.css` (required), `theme.css` (optional, light and dark), `avatar.css`. See `STYLES.md` for every class and variable.
- `localStorageStore` throws for a prefix that contains `:`, because the key would be ambiguous.
- The exact exported surface is frozen in `API-FREEZE.md`.

### Engine changes from driver.js, by fork task

- F-03: classes renamed from `driver-` to `vt-`, state exposed as data attributes, and a `namespace` option.
- F-04: the cut-out is clipped by the scroll containers that crop the target.
- F-05: extra cut-outs for allowed elements anywhere on the page, deduplicated.
- F-06: popover boundary, viewport padding, and `side: "over"` for targets.
- F-07: flip, alignment flip and shift switches, and `side: "auto"`.
- F-08: cross-axis offset, RTL mirroring, arrow off and minimum arrow inset. A popover whose direction differs from its target's takes the target's direction while the step has a real target (a `dir` it replaced is restored afterwards); for targetless steps `info.rtl` follows the page direction.
- F-09: the highlight follows nested scroll containers, with an optional scroll-parent lock.
- F-10: `absolute` position strategy for transformed containers.
- F-11: reveal options, native `scrollIntoView` options, and reduced-motion-safe scrolling.
- F-12: per-corner cut-out radius.
- F-13: `mountIn` and `dimMountIn` containers for the popover and overlay.
- F-14: `prefers-reduced-motion` honored in the engine.
- V-02, V-05, V-06 and A-04: engine seams for the public API, accessible names and sanitized content, action steps, and the speaker layout.
- Upstream cherry-picks: `onDestroyed` fires when a tour closes before its first step settles, very long waits no longer expire at once, Tab skips hidden or inert controls, and focus returns to the trigger only when the tour still holds it.
- Removed: hints and checklist.
- Refresh cost: fewer style reads per reposition, and the extra cut-out path is reused while the rectangles stay the same.
