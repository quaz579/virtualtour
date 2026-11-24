# 13. Licensing, attribution, and the avatar art rules

This file holds: the MIT obligations of forking driver.js and what the PRD's clean-room
rules cover now (§1); the avatar recommendation with evidence (§2); what can and cannot
be reused from felixrieseberg/clippy (§3); the line the Thumbtack character must stay on
(§4); the plan for the docs page "Loading a classic paperclip (Clippy) avatar pack" (§5);
the loader rules that keep the project from ever redistributing Microsoft art (§6); and
the license and notice files the package ships (§7).

Nothing here is legal advice. The PRD (§8) requires a review by an IP or open-source
lawyer before 1.0; `RELEASE-CHECKLIST.md` (V-17) carries that item.

---

## 1. Forking driver.js under MIT

### 1.1 What MIT requires of a fork

driver.js is MIT (repository file `license`, package file `packages/driver/license`, both
reading "The MIT License / Copyright (c) Kamran Ahmed"; `packages/driver/package.json`
`"license": "MIT"`, author `Kamran Ahmed`; CONFIRMED 2026-11-12 from the clone at tag
`1.12.1`). MIT lets the project use, copy, modify, merge, publish, distribute, sublicense,
and sell the code, on one condition: **the copyright notice and the permission notice
must be included in all copies or substantial portions of the software.** A fork is the
whole software, so:

- `LICENSE` (repository root and `packages/core/LICENSE`) is the MIT text with **two**
  copyright lines: `Copyright (c) Kamran Ahmed` (kept verbatim) and
  `Copyright (c) <year> VirtualTour contributors` (ours, alongside; holder decided by maintainer,
  2026-11-13, `12-risks-open-questions.md` #10). The permission notice and the warranty disclaimer
  follow unchanged. Both lines travel with every copy, including the npm tarball and the
  wrapper packages.
- `NOTICE.md` records the provenance so nobody has to guess: upstream repository
  `https://github.com/nilbuild/driver.js`, fork point tag `1.12.1`, commit
  `0163642dc532417ea401684bd26690e2f3283d63`, released 2026-11-11, the original notice
  verbatim, the statement that `packages/core/src/engine/` derives from
  `packages/driver/src/` at that commit, the files deliberately not carried over
  (`hints.ts`, `checklist.ts`, their stylesheets, the Astro apps, the build config), and
  a pointer to `UPSTREAM.md` for later cherry-picks (each of which cites its upstream SHA
  in the commit message).
- `docs/licensing.md` and `docs/guide/how-it-works.md` say the same in plain language.
- Per-file headers are not required by MIT and are not added; the engine directory's
  `README` (F-02) states the derivation once.
- Our changes to the engine are licensed under the same MIT terms (the project's single
  license). There is no dual license and no license change.

### 1.2 The PRD's clean-room rules

The PRD's §8 clean-room guidelines were written for an in-house engine built from public
documentation only. The owner decided on 2026-11-12 to fork driver.js instead. So for the
tour core:

- **Reading, modifying, and keeping driver.js source is the whole point.** Every file under
  `src/engine/` is driver.js code we own a copy of under MIT. Cite upstream line numbers in
  tasks and tests as this plan does; it is how a later reader finds the origin of a change.
- **Option and method names in the public API** are this project's own choice for API
  design reasons (`01-architecture.md` §4), not for legal ones. Internal engine names stay
  driver.js's.
- **Documentation**: write our own prose. driver.js's docs (`apps/docs/`) are MIT too, but
  copying pages would carry their structure and examples into ours and make the migration
  page confusing; quote a sentence with a link when it helps.
- **Commit history** shows the fork point as one import commit (F-01) and every change
  after it as our work, so the derivation is plain.

The checklist in the first plan ("I have not read the source of any tour library") is
withdrawn for driver.js. It still applies to **other** tour libraries only in the weak
sense that we do not copy their code into this project without a license that allows it
and a notice in `NOTICE.md`.

### 1.3 The avatar art: unchanged

Everything in §2 through §6 stands exactly as before. The avatar subsystem and the
Thumbtack character are original work; no third-party character art, animation data
describing it, or screenshots of it enter the repository, docs, demo, tests, or tarball.
The CC0 notice for the art is described in §7.

### 1.4 Checklist (every implementer, every PR)

- [ ] `LICENSE` carries both copyright lines; no file under `src/engine/` is relicensed.
- [ ] A cherry-pick from upstream cites its upstream SHA in the commit message
      (`Upstream: <sha> (<version>)`), so the derivation stays traceable.
- [ ] No other library's code is copied in without a permissive license and a `NOTICE.md`
      entry.
- [ ] No third-party character art, screenshot of such art, or animation data describing
      such art enters the repository (§6).
- [ ] No company, product, customer, board, or ticket name appears anywhere. driver.js,
      its repository URL, and its author's copyright line are the one allowed exception.
- [ ] Before 1.0: a lawyer reviews `LICENSE`, `NOTICE.md`, `ART.md`,
      `src/avatar/thumbtack/LICENSE-ART.md`, and `docs/avatar/classic-packs.md`;
      maintainers sign `RELEASE-CHECKLIST.md`.

---

## 2. Avatar recommendation: Thumbtack (original), not openclippy

**Recommendation: do not adopt openclippy. Ship the original Thumbtack character.**
openclippy's code is MIT, but its character art is Microsoft's Clippy sprite sheet, and
the repository's claim that Microsoft open-sourced that art is unsupported. Adopting it
would make this project redistribute Microsoft-owned art under a license its author cannot
grant.

### 2.1 What was examined (2026-11-12, read-only clones)

- `https://github.com/lennystepn-hue/openclippy` (default branch, v0.5.7 in `package.json`).
- `https://github.com/felixrieseberg/clippy` (default branch, v0.4.3).
- GitHub API metadata and README for `thebeebs/OfficeAssistant` (the repository openclippy
  cites as the source of Microsoft's "open-sourcing").

### 2.2 Evidence

| # | Finding | Where |
|---|---|---|
| 1 | openclippy's `LICENSE` is MIT, "Copyright (c) 2026 OpenClippy Contributors". It covers "the Software". | `openclippy/LICENSE` |
| 2 | openclippy says its sprites are "Original Retro Sprites: Authentic Office 97 Clippy, 43 animation states extracted from the original `.acs` files" and lists "Sprites: Original Office 97 Clippy (extracted from `.acs`)" in its tech stack. | `openclippy/README.md`, "Features" and "Tech Stack" tables |
| 3 | openclippy's FAQ: "The sprites are from the original Office Assistant which Microsoft open-sourced." Its credits link that claim to `thebeebs/OfficeAssistant` ("for creating Clippit in 1997 and open-sourcing the Office Assistant code"). | `openclippy/README.md`, "FAQ" and "Credits" |
| 4 | `thebeebs/OfficeAssistant` is a 2015 C++ repository with **no license file** (GitHub API `license: null`), whose README says the code "is now available to anyone for one day only". It is a code dump, not an art release, and it is not a Microsoft organization repository. It does not support the claim in #3. | GitHub API and README of `thebeebs/OfficeAssistant` |
| 5 | openclippy's sprite sheet `assets/sprites/clippy-map.png` (3348 x 3162 px, 27 x 34 grid of 124 x 93 frames) is **byte-identical** to felixrieseberg/clippy's `assets/animations/clippy/map.png`: both have MD5 `bbeb1cb706c83842350985cb958dc29c`. | `md5` on both clones |
| 6 | felixrieseberg/clippy's `LICENSE.md` states: "The Clippy character, imagery, and associated assets are copyrighted by Microsoft Corporation. This project uses these assets under fair use for nostalgic/educational purposes. The MIT license above applies only to the code written for this project, not to any Microsoft-owned intellectual property." Its README adds that the character was designed by illustrator Kevan Atteberry for Microsoft and that the app "is not affiliated, approved, or supported by Microsoft". | `felix-clippy/LICENSE.md`, `README.md` |
| 7 | openclippy's animation data (`assets/sprites/sprite-data.json`, 43 animations) matches felixrieseberg/clippy's `animations.json` frame for frame in 42 of 43 animations (the 43rd differs in one frame duration). openclippy credits `pi0/clippyjs` "for preserving the original Clippy sprites" and lists `clippyjs` as a dev dependency. The art is therefore the long-circulating Clippy sheet from the clippy.js lineage, not newly extracted or redrawn. | comparison script over both JSON files; `openclippy/README.md` credits; `openclippy/package.json` |
| 8 | openclippy's own sprite code (`src/renderer/animations.ts`, `clippy.ts`, `clippy-data.ts`) is MIT and is a `background-position` sprite player. Its commit history (shallow clone shows author "Volt <volt@lenny.dev>") gives no provenance statement for the code. | `openclippy/src/renderer/*` |

### 2.3 Conclusion

- **Art:** Microsoft's. openclippy's MIT license cannot cover it (the author is not the
  rights holder), and felixrieseberg/clippy, which ships the identical file, says so
  explicitly. The "Microsoft open-sourced it" statement traces to a repository with no
  license and no art. Not clean for an MIT project that wants enterprise adopters.
- **Code:** MIT and small, but it is an Electron desktop app, not a library; nothing in it
  is needed, and its provenance is undocumented. Not adopted.
- **Therefore:** the shipped character is **Thumbtack**, original art created in this
  project (`02-avatar.md` §9), with its source frames committed so the provenance is in the
  history.

### 2.4 Side note on the broader Clippy lineage

The widely used web Clippy players (clippy.js and its forks) carry the same Microsoft
sprite sheets. Their code licenses (MIT) are fine; their art is still Microsoft's. The
project treats all of them the same way: the integrator may load such a pack from their own
hosting, and the project never ships it (§5, §6).

---

## 3. What can be reused from felixrieseberg/clippy (MIT code only)

The expectation was that the repository held a reusable sprite animation player. On
inspection it does not: the app pre-renders every animation into an APNG file with a shell
script and the React component just swaps `<img src>` and waits a fixed duration. Below is
every candidate file and the verdict.

| File | What it is | Verdict |
|---|---|---|
| `assets/animations/clippy/animations.json` | The classic animation map: an array of `{ Name, Frames: [{ Duration, ImagesOffsets: { Column, Row } }] }`. Frame timings extracted from Microsoft's `.acs` data. | **Do not ship.** It describes Microsoft's sheet and is only useful with it. **Do support its shape** as "classic Format A" in `loadClassicAvatarPack` (`03-schemas.md` §2.4) so integrators can load it from their own hosting. The shape (field names) is recorded in the plan from inspection; no file is copied. |
| `assets/animations/clippy/map.png` | The Microsoft Clippy sprite sheet. | **Never** copy, reference by URL, screenshot, or commit. |
| `src/renderer/clippy-animation-helpers.tsx` (42 lines) | `getRandomAnimation(keys, current)` / `getRandomIdleAnimation(current)`: picks a random animation not equal to the current one; `IDLE_ANIMATION_KEYS` = names starting with `Idle`; an `EMPTY_ANIMATION` 1x1 GIF data URL. | **Optional reuse** of the random-pick idea; the plan's `resolveRole('idle', _, avoid)` (A-01) is a 10-line rewrite with an injectable RNG. If any lines are copied verbatim, keep the MIT notice (`Copyright 2025 Felix Rieseberg`) in `NOTICE.md`. The "starts with `Idle`" convention is reused as the default classic role mapping. |
| `src/renderer/clippy-animations.tsx` (230 lines, generated) | Table of per-animation APNG imports and total lengths in ms. | **Not reusable** (APNG approach, generated, app-specific). |
| `src/renderer/components/Clippy.tsx` (129 lines) | React component: sets `<img src>` to an APNG, `setTimeout` back to `Default` after `length + 200` ms; idle loop with `setTimeout(WAIT_TIME = 6000)`; coupled to app contexts. | **Not reusable** as a sprite player. The 6 s idle wait is a sensible default and the plan uses the same number (`idleQuietMs: 6000`), a design choice, not copied code. |
| `tools/extract-animations.sh` (351 lines, bash) | Converts sheet + JSON into one APNG per animation with ImageMagick and apngasm. Derives frame size as `sheetWidth / (maxColumn + 1)`. | **Not reused.** The only idea taken is deriving the frame size from the image size and the max column/row when a Format A map lacks it (A-07); that is a one-line formula. |
| `src/renderer/components/BubbleWindow*.tsx`, `css/98.extended.css`, `Theme.css` | Chat window and a 1990s UI skin on top of the `98.css` package. | **Not reusable** and not wanted (the skin would read as Microsoft trade dress). |
| Everything else (`src/main/**`, Electron, LLM, settings) | Desktop app plumbing. | Not relevant. |

**Net recommendation:** reuse nothing verbatim. Write the sprite player new (A-02).
Support the classic map shape in the loader (A-07). If the random idle picker is copied,
keep its MIT notice.

---

## 4. Thumbtack: the parody and trademark line

Why a parody at all: the premise (an eager office supply that pops up to help) is the joke,
and the joke is in the premise, not the drawing. Parody is a fair-use defense in some
jurisdictions and not a license anywhere; the project does not rely on it. It relies on
Thumbtack being an independent work.

Rules for the character (checked at A-03 review and in `ART.md`):

- Thumbtack is a push pin with a flared top, narrow waist, wide domed base and thin needle. It is **not a paperclip** and
  has no wire loops, bends, or any paperclip silhouette.
- Eyes and eyebrows are drawn fresh. Do not trace, measure, or reproduce the paperclip's
  eye spacing, eyebrow curve, or signature poses (the "raise one eyebrow" tilt, the
  knock-on-glass, the notepad).
- No yellow note-paper speech bubble styling that imitates the Office Assistant balloon.
  The bubble uses the library's own styling on top of the engine's popover.
- The names "Clippy", "Clippit", and "Office Assistant" are not used for the character, the
  package, the docs site title, or marketing copy. They appear only in the one docs page
  that explains how to load such a pack (§5), where they describe Microsoft's property.
- No "Microsoft", "Office", or Windows-era UI trade dress (window chrome, system fonts
  imitation, startup sounds).
- The character's description, source SVGs, and build script are committed in this
  project, so the record shows original creation.
- `ART.md` states: the character is original to this project, names the author, states the
  art license, and states that no third-party character art is accepted into the
  repository.

Art license: CC0 1.0, decided by the owner 2026-11-12 (§7).

---

## 5. Docs page plan: "Loading a classic paperclip (Clippy) avatar pack"

File: `docs/avatar/classic-packs.md`, built in V-15. **Decided 2026-11-12: the page ships
in release one; the PRD §8 lawyer review covers its wording** (V-17 checklist). Purpose: let
an integrator who wants the nostalgic paperclip load it themselves, from their own hosting,
with a clear statement of what the project does and does not provide, so a company pulling
in the library does not accidentally redistribute someone else's art or believe it is
licensed.

### 5.1 Outline

1. **Title:** "Loading a classic paperclip (Clippy) avatar pack (not included)".
2. **Warning block** (§5.3, verbatim, at the top).
3. **What this project ships:** code under MIT (this project's, derived from driver.js);
   the Thumbtack character (original art, CC0); a loader that can read two classic
   animation-map shapes. **What it does not ship:** any Microsoft character art or
   animation data, any link to a file containing it.
4. **Before you start (your responsibility):** you need your own rights basis to use the
   art (a license, a legal assessment such as fair use in your jurisdiction, or a policy
   decision by your organization). The project cannot grant one and makes no promise that
   a given use is lawful. Check with your legal team.
5. **What files you need:** a sprite sheet image and an animation map, in one of the two
   shapes the loader accepts (link to `03-schemas.md` §2.4 content in the docs). Explain
   how to tell the shapes apart. Do **not** say where to download them; say that existing
   open-source desktop apps and web players that reproduce the character carry such files
   under code-only MIT licenses, and that their license files say the art remains
   Microsoft's (link to felixrieseberg/clippy's `LICENSE.md` page as the example of such a
   notice, because reading it is the point).
6. **Host them yourself:** put both files on hosting you control. Do not add them to a
   public npm package. Do not import them through this library's package.
7. **Loader call** with placeholder URLs:
   ```ts
   import { withAvatar, loadClassicAvatarPack } from 'virtualtour/avatar';
   const pack = loadClassicAvatarPack({
     sheetUrl: 'https://assets.your-company.example/avatars/paperclip/map.png',
     mapUrl:   'https://assets.your-company.example/avatars/paperclip/animations.json',
     frameSize: { w: 124, h: 93 },   // only needed for the column/row map shape
   });
   const tour = createTour({ presenter: withAvatar(pack), steps: [...] });
   ```
8. **Role mapping table** (the defaults from `03-schemas.md` §2.4) and how to override
   with `roles`.
9. **Behavior notes:** sound and branching fields are ignored; reduced motion shows a still
   frame; the `license` field of a classic pack is set to "unknown / supplied by the
   integrator" and logged once in dev builds.
10. **Trademark note:** do not name your product or feature after the character; do not use
    the name in marketing; the names are used on this page only to identify Microsoft's
    property.
11. **Checklist** (copyable): rights basis confirmed; files hosted by you; not in a public
    package; legal review done if your organization requires it; attribution handled per
    your rights basis.
12. **Prefer the shipped character?** Link to the Thumbtack page.

### 5.2 Things the page must not contain

- Any image of the paperclip (use a Thumbtack screenshot or none).
- Any direct link to a sheet or map file, any CDN path to one, or any npm package name
  that ships one.
- Any statement that the art is open source, public domain, or "free to use".
- Any statement that fair use applies to the reader.

### 5.3 Required warning block (tested verbatim by V-15)

```
> **Not included, not open source.** The classic paperclip character and its artwork belong
> to Microsoft Corporation. This project does not ship, host, link to, or license that art.
> The MIT license of this project covers this project's code and its own Thumbtack character
> only. If you load third-party character art with this library, you are responsible for
> having the right to use it. Nothing on this page is legal advice.
```

---

## 6. Loader rules so the project never redistributes Clippy assets

- `loadClassicAvatarPack` takes URLs only. There is no bundled classic pack, no default URL,
  and no "well-known" fallback path.
- The library never fetches from a hard-coded third-party host. Every fetch target is a
  string the integrator passed.
- The repository, the npm tarball, the docs site, and the demo contain no third-party
  character sheet or map. Enforced by the art tripwire tests (A-07, V-15, V-17): no PNG
  over 200 KB under `src/avatar`, `e2e/fixtures`, or `docs/`; no JSON with 40 or more
  animations; no image whose name contains "clippy", "clippit", or "office-assistant".
- Classic-format tests use a synthetic pack generated by `tools/make-test-pack.mjs`
  (colored squares with frame numbers) that merely follows the two JSON shapes.
- Dev builds log the loaded pack's `license.name`; a classic pack logs "unknown (supplied by
  the integrator)" once, so teams notice what they loaded.
- The converted pack is held in memory only; the loader never writes files or caches to
  storage.

---

## 7. License and notice files shipped in the core package

- `LICENSE`: the MIT text with the two copyright lines (§1.1), then one pointer sentence
  at the end: "The Thumbtack character artwork in `src/avatar/thumbtack/` and
  `dist/thumbtack/` is dedicated to the public domain under CC0 1.0; see
  `src/avatar/thumbtack/LICENSE-ART.md`. Third-party character art: this project ships
  none. Loading third-party art through the avatar loader is the integrator's
  responsibility."
- `NOTICE.md`: the fork provenance (§1.1), plus, only if the random idle picker was copied
  verbatim (§3), a felixrieseberg/clippy entry: file, lines, "Copyright 2025 Felix
  Rieseberg, MIT", and the MIT text.
- `src/avatar/thumbtack/LICENSE-ART.md` (copied into `dist/thumbtack/` by the build): the
  CC0 1.0 Universal legal text (`https://creativecommons.org/publicdomain/zero/1.0/legalcode`)
  with a one-line header: "The Thumbtack character (the SVG sources, `frames.mjs`,
  `sheet.png`, and `pack.json` in this directory) is original to this project and is
  released under CC0 1.0. No rights reserved; no credit required." **Decided by the owner
  2026-11-12** (`12-risks-open-questions.md` §2). The code in
  `tools/build-thumbtack-pack.mjs` stays MIT like the rest of the code; only the art
  outputs and their parametric description are CC0.
- `pack.json` `license`: `{ "name": "CC0-1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/",
  "attribution": "Thumbtack character, original to this project; no credit required" }`.
- `ART.md`: provenance of Thumbtack (§4), the no-third-party-art rule, and the CC0
  dedication with a link to `LICENSE-ART.md`.
- `docs/licensing.md` (V-15) repeats the items in plain language for readers who do not
  open the tarball: code MIT with both copyright holders and the fork point, Thumbtack
  CC0, no third-party art.
- Wrapper packages ship the same `LICENSE` (without the art sentence) and a `NOTICE.md`
  that points at the core package's notice.
- Changes offered back to upstream (goodwill, never required) are licensed to driver.js
  under its MIT license by the act of contributing. Upstream has no `CONTRIBUTING` file
  and no CLA at the fork point (CONFIRMED 2026-11-12); if that changes, follow whatever it
  asks.
