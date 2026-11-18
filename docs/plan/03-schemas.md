# 03. JSON schemas

Two versioned JSON formats ship with the library as JSON Schema (draft 2020-12) files under
`packages/core/schemas/`, plus the two "classic" animation map shapes the avatar loader
accepts (not shipped as schemas; documented here for the converter). Validation at runtime
is done by small hand-written checks (no schema library); the JSON Schema files are for
editors, CMS validation, and tests.

The tour schema describes **VirtualTour's** `TourConfig`, not the engine's `Config`. A JSON
tour is parsed into a `TourConfig` and then compiled to the engine by `compile.ts`
(`01-architecture.md` §6). Nothing in the JSON format names the engine.

---

## 1. Tour schema v1 (`tour.v1.schema.json`)

### 1.1 Purpose

A tour that can be stored in a database or CMS and loaded with `parseTourJson()`. Only
JSON-safe values are allowed. Anything that is a function in `TourConfig` is expressed as a
**handler name**, resolved from the `handlers` map passed to `parseTourJson()`. Anything that
is a DOM element in `TourConfig` is expressed as a **CSS selector string**. Unknown handler
names throw `TourJsonError` with the JSON path.

### 1.2 Shape

```jsonc
{
  "format": "virtualtour-tour/1",          // required, exact string
  "id": "billing-intro",                   // optional
  "name": "Billing introduction",          // optional
  "dim": true,                             // boolean | DimConfig
  "mountIn": "#app",                       // selector (T-6); DOM element form is code-only
  "dimMountIn": "#app",                    // selector (T-6)
  "namespace": "vt",                       // T-10
  "keys": { "escape": true, "arrows": true },
  "exitPrompt": "Leave the tour?",         // false | string | { "handler": "confirmExit" }
  "counter": true,                         // boolean | { "handler": "counterText" }
  "labels": { "next": "Next", "back": "Back", "done": "Done", "close": "Close" },
  "animate": true,
  "stepDefaults": { /* StepJson without id */ },
  "steps": [ /* StepJson */ ]              // required, may be empty
}
```

`DimConfig` in JSON: `{ "padding": 10, "radius": 5 | { "topLeft": 5, "topRight": 5,
"bottomRight": 5, "bottomLeft": 5 }, "transitionMs": 400, "color": "#000", "opacity": 0.7,
"clickOutside": "none", "pageScroll": true, "lockScrollParent": false,
"clipToScrollParents": true }`.

`StepJson`:

```jsonc
{
  "id": "save",                                       // optional
  "title": "Save your work",                          // string | { "handler": "titleFor" }
  "body": "Click <b>Save</b>.",                       // string | string[] (HTML, unsanitized unless `sanitize` is set)
  "label": "Save step",                               // string | { "handler": ... }
  "closeButton": true,                                // boolean | { "label": string, "attrs": {...} }
  "classes": ["intro"],                               // string | string[]
  "meta": { "analyticsId": "s-1" },                   // any JSON
  "buttons": [
    { "text": "Back", "action": "backward", "kind": "secondary" },
    { "text": "Next", "action": "forward" },
    { "text": "Open settings", "action": { "handler": "openSettings" } }
  ],
  "target": "#save",                                  // string selector | { "handler": "findSave" }
  "placement": { "side": "bottom", "align": "start" }, // or "auto", or { "side": "auto" | "over" }
  "position": {
    "offset": 10,                                     // number | { "main": 10, "cross": 0 }
    "viewportPadding": 8,
    "flip": true, "shift": true,
    "strategy": "fixed",                              // "fixed" | "absolute"
    "arrow": true                                     // boolean | { "minInset": 15 }
  },
  "waitFor": 3000,                                    // A-8: plain number
  "whenMissing": "skip",                              // A-8: plain string
  "shouldShow": { "handler": "isBillingVisible" },
  "prepare": { "handler": "openBillingPanel" },
  "spotlight": { "padding": 6, "radius": 8, "extra": ["#save-hint"], "class": "glow", "targetInteractive": true },
  "reveal": "smooth",                                 // boolean | "smooth" | ScrollIntoViewOptions
  "revealWith": { "handler": "customScroll" },
  "autoAdvance": { "event": "click", "selector": "#save", "strict": false },
  "instruction": "Click Save to continue.",           // string | { "handler": ... } (action step)
  "advanceDelay": 600,
  "focus": "dialog",
  "extensions": { "avatar": { "animation": "point.left" } }
}
```

Rules:

- `body` as a DOM element is not representable; `parseTourJson` accepts only strings.
- `mountIn` / `dimMountIn` as elements are not representable; JSON carries selectors, resolved
  at `start()`; a selector that matches nothing throws `TourEnvironmentError` with the path.
- `handler` objects are the only place functions appear. The resolved function is used as-is
  (for `title`, `label`, `text`, `instruction`, the handler returns a string; for
  `exitPrompt`, a boolean or promise; for `action`, the button handler).
- `format` is required and must equal `virtualtour-tour/1`. A future `/2` can add fields;
  parsers refuse unknown major versions.
- `serializeTour(config)` is the inverse: it throws `TourJsonError` when a function or an
  element is present without a registered name (the caller passes
  `handlerNames: Map<Function, string>`; elements are serialized only when `tour.id`-scoped
  `elementSelectors: Map<Element, string>` is passed).
- `additionalProperties: false` everywhere, so a typo never silently does nothing.

### 1.3 JSON Schema skeleton

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "virtualtour-tour.v1.schema.json",
  "type": "object",
  "required": ["format", "steps"],
  "additionalProperties": false,
  "properties": {
    "format": { "const": "virtualtour-tour/1" },
    "id": { "type": "string" }, "name": { "type": "string" },
    "dim": { "oneOf": [ { "type": "boolean" }, { "$ref": "#/$defs/dim" } ] },
    "mountIn": { "type": "string" }, "dimMountIn": { "type": "string" },
    "namespace": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]*$" },
    "keys": { "type": "object", "additionalProperties": false, "properties": { "escape": {"type":"boolean"}, "arrows": {"type":"boolean"} } },
    "exitPrompt": { "oneOf": [ { "const": false }, { "type": "string" }, { "$ref": "#/$defs/handler" } ] },
    "counter": { "oneOf": [ { "type": "boolean" }, { "$ref": "#/$defs/handler" } ] },
    "labels": { "type": "object", "additionalProperties": false, "properties": {
      "next": {"type":"string"}, "back": {"type":"string"}, "done": {"type":"string"}, "close": {"type":"string"} } },
    "animate": { "type": "boolean" },
    "stepDefaults": { "$ref": "#/$defs/step" },
    "steps": { "type": "array", "items": { "$ref": "#/$defs/step" } }
  },
  "$defs": {
    "handler": { "type": "object", "required": ["handler"], "additionalProperties": false,
                 "properties": { "handler": { "type": "string" } } },
    "text": { "oneOf": [ { "type": "string" }, { "$ref": "#/$defs/handler" } ] },
    "corners": { "type": "object", "additionalProperties": false, "properties": {
      "topLeft": {"type":"number","minimum":0}, "topRight": {"type":"number","minimum":0},
      "bottomRight": {"type":"number","minimum":0}, "bottomLeft": {"type":"number","minimum":0} } },
    "radius": { "oneOf": [ { "type": "number", "minimum": 0 }, { "$ref": "#/$defs/corners" } ] },
    "dim": { "type": "object", "additionalProperties": false, "properties": {
      "padding": { "type": "number", "minimum": 0 }, "radius": { "$ref": "#/$defs/radius" },
      "transitionMs": { "type": "number", "minimum": 0 }, "color": { "type": "string" },
      "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
      "clickOutside": { "enum": ["none", "exit", "forward"] }, "pageScroll": { "type": "boolean" },
      "lockScrollParent": { "type": "boolean" }, "clipToScrollParents": { "type": "boolean" } } },
    "button": { "type": "object", "required": ["text", "action"], "additionalProperties": false, "properties": {
      "text": { "$ref": "#/$defs/text" }, "label": { "$ref": "#/$defs/text" },
      "action": { "oneOf": [ { "enum": ["forward","backward","exit","finish"] }, { "$ref": "#/$defs/handler" } ] },
      "disabled": { "oneOf": [ { "type": "boolean" }, { "$ref": "#/$defs/handler" } ] },
      "kind": { "enum": ["primary", "secondary"] },
      "classes": { "oneOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" } } ] },
      "attrs": { "type": "object", "additionalProperties": { "type": "string" } } } },
    "placement": { "oneOf": [ { "const": "auto" }, { "type": "object", "required": ["side"], "additionalProperties": false, "properties": {
      "side": { "enum": ["top","bottom","left","right","auto","over"] }, "align": { "enum": ["start","center","end"] } } } ] },
    "position": { "type": "object", "additionalProperties": false, "properties": {
      "offset": { "oneOf": [ { "type": "number" }, { "type": "object", "additionalProperties": false, "properties": {
        "main": { "type": "number" }, "cross": { "type": "number" } } } ] },
      "viewportPadding": { "type": "number", "minimum": 0 },
      "flip": { "type": "boolean" }, "shift": { "type": "boolean" },
      "strategy": { "enum": ["fixed", "absolute"] },
      "arrow": { "oneOf": [ { "type": "boolean" }, { "type": "object", "additionalProperties": false, "properties": {
        "minInset": { "type": "number", "minimum": 0 } } } ] } } },
    "spotlight": { "type": "object", "additionalProperties": false, "properties": {
      "padding": {"type":"number","minimum":0}, "radius": { "$ref": "#/$defs/radius" },
      "extra": { "type": "array", "items": { "type": "string" } }, "class": { "type": "string" },
      "targetInteractive": { "oneOf": [ { "type": "boolean" }, { "const": "hover-only" } ] } } },
    "scrollIntoView": { "type": "object", "additionalProperties": false, "properties": {
      "behavior": { "enum": ["auto", "smooth", "instant"] }, "block": { "enum": ["start","center","end","nearest"] },
      "inline": { "enum": ["start","center","end","nearest"] } } },
    "step": { "type": "object", "additionalProperties": false, "properties": {
      "id": { "type": "string" }, "title": { "$ref": "#/$defs/text" },
      "body": { "oneOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" } } ] },
      "label": { "$ref": "#/$defs/text" },
      "closeButton": { "oneOf": [ { "type": "boolean" }, { "type": "object", "additionalProperties": false, "properties": {
        "label": { "$ref": "#/$defs/text" }, "attrs": { "type": "object", "additionalProperties": { "type": "string" } } } } ] },
      "classes": { "oneOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" } } ] },
      "meta": {},
      "buttons": { "type": "array", "items": { "$ref": "#/$defs/button" } },
      "target": { "oneOf": [ { "type": "string" }, { "$ref": "#/$defs/handler" } ] },
      "placement": { "$ref": "#/$defs/placement" },
      "position": { "$ref": "#/$defs/position" },
      "waitFor": { "type": "number", "minimum": 0 },
      "whenMissing": { "enum": ["center", "skip"] },
      "shouldShow": { "$ref": "#/$defs/handler" }, "prepare": { "$ref": "#/$defs/handler" },
      "spotlight": { "$ref": "#/$defs/spotlight" },
      "reveal": { "oneOf": [ { "type": "boolean" }, { "const": "smooth" }, { "$ref": "#/$defs/scrollIntoView" } ] },
      "revealWith": { "$ref": "#/$defs/handler" },
      "autoAdvance": { "type": "object", "required": ["event"], "additionalProperties": false, "properties": {
        "event": { "oneOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" } } ] },
        "selector": {"type":"string"}, "strict": {"type":"boolean"} } },
      "instruction": { "$ref": "#/$defs/text" },
      "advanceDelay": { "type": "number", "minimum": 0 },
      "focus": { "enum": ["dialog", "first-button"] },
      "extensions": { "type": "object" } } }
  }
}
```

The task that implements this (V-11) writes the full file and a test that validates every
docs example against it with a dev-only schema validator (dev dependency; never shipped).

### 1.4 How a step compiles to the engine (reference for `compile.ts`, task V-01)

| `StepConfig` field | engine `DriveStep` / `Config` | Notes |
|---|---|---|
| `target` | `element: () => Element \| null` | always a function so the lookup is lazy (A-1); the navigator has already resolved it, the function returns the cached element |
| `title` (string or fn) | `popover.title` | functions evaluated at compile-for-show time |
| `body` string / `string[]` | `popover.description` (joined `<p>` for arrays) | through `sanitize` |
| `body` Element / fn→Element | `popover.description` unset; `.vt-body` part | presenter mounts it |
| `label` | `popover.label` | engine sets `aria-label` (V-05) |
| `closeButton` | `showButtons` includes `'close'`; `closeBtnLabel` | `attrs` applied by the presenter |
| `classes`, `position.arrow: false` | `popover.popoverClass`; `popover.arrow: false` | engine adds `vt-no-arrow` (F-08) |
| `buttons` | `showButtons: ['close']` + `.vt-footer` part | engine next/back hidden |
| `placement` | `popover.side` (`Side \| 'auto' \| 'over'`), `popover.align` | absent with a target → `'over'` (A-3, F-06); `'auto'` → F-07 |
| `position.offset` | `popoverOffset`, `popoverCrossOffset` (per step, V-02 / F-08) | |
| `position.viewportPadding` | `popoverPadding` (per step) | F-06 |
| `position.flip` / `shift` | `popover.flip` / `popover.shift` | F-07 |
| `position.strategy` | `popover.strategy` | F-10 |
| `position.arrow.minInset` | `popover.arrowMinInset` | F-08 |
| `spotlight.padding/radius` | `stagePadding` / `stageRadius` (per step, V-02; corners F-12) | |
| `spotlight.extra` | `allowedElements` | cut-outs + dedupe in the engine (F-05) |
| `spotlight.targetInteractive` | `disableActiveInteraction: true \| "clicks"` | |
| `waitFor`, `whenMissing`, `shouldShow`, `prepare`, `revealWith` | handled by `navigator.ts`; `skipMissingElement` set when `whenMissing === 'skip'`; `scrollIntoView: false` when `revealWith` is set | A-9 ordering |
| `reveal` | `scrollIntoView: false \| ScrollIntoViewOptions` per step; `'smooth'` → `{ behavior: 'smooth' }`; `true` → engine default | F-11 |
| `autoAdvance` without `selector` | `advanceOn: event` or `{ event, strict }` | the engine listens on the target |
| `autoAdvance` with `selector` | `advance/auto-advance.ts` document listener → `tour.forward()` | |
| `instruction` | `popover.instruction` | action step (V-06) |
| `advanceDelay` | `advanceDelay` (per step) | V-06 |
| `focus` | (none) | presenter |
| `counter` | `Config.showProgress`, `popover.progressText` | function counters produce the string per step |
| `meta`, `extensions`, `id` | `data: { vt: TourStep }` | the hooks map `DriveStep` back to `TourStep` through `data.vt` |
| `TourConfig.dim: false` | `Config.overlay: false` | V-02 |
| `TourConfig.mountIn` / `dimMountIn` | `Config.mountIn` / `dimMountIn` | F-13 |
| `TourConfig.namespace` | `Config.namespace` | F-03 |
| `TourConfig.keys` | `Config.allowEscape` / `allowArrowKeys` | V-02 |
| `DimConfig.lockScrollParent` / `clipToScrollParents` | `Config.lockScrollParent` / `clipStageToScrollParents` | F-09 / F-04 |

---

## 2. Avatar pack schema v1 (`avatar-pack.v1.schema.json`)

### 2.1 Shape

```jsonc
{
  "format": "virtualtour-avatar/1",        // required
  "name": "Thumbtack",                     // required
  "version": "1.0.0",                      // optional, pack's own version
  "sheet": {
    "src": "./sheet.png",                  // required; relative to the pack JSON URL
    "frameWidth": 96,                      // required, CSS px
    "frameHeight": 96,                     // required, CSS px
    "columns": 10,                         // optional; derived from the image width if absent
    "scale": 2,                            // optional; the image is this many device px per CSS px (default 1)
    "pixelArt": false                      // optional; sets image-rendering: pixelated
  },
  "animations": {
    "rest":  { "frames": [ { "col": 0, "row": 0, "ms": 100 } ] },
    "wave":  { "frames": [ { "col": 1, "row": 0, "ms": 90 }, { "col": 2, "row": 0, "ms": 90 } ], "loop": false, "still": 0 },
    "think": { "frames": [ ... ], "loop": true }
  },
  "roles": {
    "rest": "rest",
    "idle": ["blink", "wobble", "look-around"],
    "greet": "wave",
    "point": { "left": "point-left", "right": "point-right", "up": "point-up", "down": "point-down", "any": "wave" },
    "think": "think",
    "celebrate": "cheer",
    "exit": "pop-out",
    "alert": "boing"
  },
  "bubble": {                              // optional presentation hints
    "dock": "end",                         // default dock for this character
    "gap": 8                               // px between bubble and avatar
  },
  "license": {                             // optional but recommended; Thumbtack's values shown
    "name": "CC0-1.0",
    "url": "https://creativecommons.org/publicdomain/zero/1.0/",
    "attribution": "Thumbtack character, original to this project; no credit required"
  }
}
```

Frame fields: `col`/`row` are grid indices (0-based); alternatively `x`/`y` give pixel
offsets in image pixels, divided by `sheet.scale` to get CSS px (either pair is allowed, not both). `ms` is the frame duration (> 0).
`still` is the frame index shown under reduced motion and after a non-loop animation ends
(default: last frame for non-loop, frame 0 for loop).

### 2.2 Validation rules (hand-written in `pack.ts`)

- `format` equals `virtualtour-avatar/1`; `name` non-empty; `sheet.src`, `frameWidth`,
  `frameHeight` present and positive.
- `animations` non-empty; every frame has `ms > 0` and either `col/row` or `x/y`.
- `roles.rest` must name an existing animation; every other role entry must name existing
  animations; missing roles default to `rest`.
- Validation errors throw `AvatarPackError` with a path (`animations.wave.frames[2].ms`).

### 2.3 JSON Schema skeleton

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "virtualtour-avatar-pack.v1.schema.json",
  "type": "object",
  "required": ["format", "name", "sheet", "animations", "roles"],
  "additionalProperties": false,
  "properties": {
    "format": { "const": "virtualtour-avatar/1" },
    "name": { "type": "string", "minLength": 1 },
    "version": { "type": "string" },
    "sheet": { "type": "object", "required": ["src", "frameWidth", "frameHeight"], "additionalProperties": false,
      "properties": { "src": {"type":"string"}, "frameWidth": {"type":"number","exclusiveMinimum":0},
        "frameHeight": {"type":"number","exclusiveMinimum":0}, "columns": {"type":"integer","minimum":1},
        "scale": {"type":"number","exclusiveMinimum":0}, "pixelArt": {"type":"boolean"} } },
    "animations": { "type": "object", "minProperties": 1, "additionalProperties": { "$ref": "#/$defs/animation" } },
    "roles": { "type": "object", "required": ["rest"], "additionalProperties": false, "properties": {
      "rest": { "type": "string" },
      "idle": { "oneOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" } } ] },
      "greet": { "type": "string" }, "think": { "type": "string" }, "celebrate": { "type": "string" },
      "exit": { "type": "string" }, "alert": { "type": "string" },
      "point": { "type": "object", "additionalProperties": false, "properties": {
        "left": {"type":"string"}, "right": {"type":"string"}, "up": {"type":"string"}, "down": {"type":"string"}, "any": {"type":"string"} } } } },
    "bubble": { "type": "object", "properties": { "dock": { "enum": ["start","end","auto"] }, "gap": { "type": "number" } } },
    "license": { "type": "object", "properties": { "name": {"type":"string"}, "url": {"type":"string"}, "attribution": {"type":"string"} } }
  },
  "$defs": {
    "frame": { "type": "object", "required": ["ms"], "properties": {
      "col": {"type":"integer","minimum":0}, "row": {"type":"integer","minimum":0},
      "x": {"type":"number","minimum":0}, "y": {"type":"number","minimum":0},
      "ms": {"type":"number","exclusiveMinimum":0} },
      "oneOf": [ { "required": ["col","row"] }, { "required": ["x","y"] } ] },
    "animation": { "type": "object", "required": ["frames"], "additionalProperties": false, "properties": {
      "frames": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/frame" } },
      "loop": { "type": "boolean" }, "still": { "type": "integer", "minimum": 0 } } }
  }
}
```

### 2.4 Classic map formats accepted by `loadClassicAvatarPack` (not shipped)

The loader converts two shapes seen in existing open-source character players. These are
**input formats** the integrator supplies; the project ships no file in either format
except a synthetic test fixture generated by `tools/make-test-pack.mjs`.

**Format A, column/row list** (an array; frame size must be given by the caller or derived
from the image size divided by `max(Column)+1` and `max(Row)+1`):

```jsonc
[
  { "Name": "Wave", "Frames": [ { "Duration": 100, "ImagesOffsets": { "Column": 0, "Row": 0 } }, ... ] },
  ...
]
```

A frame whose `ImagesOffsets` is null (sound-only or branch frames in the original format)
is dropped; a frame with extra fields (`Sound`, `Branching`, `ExitBranch`) keeps only
`Duration` and `ImagesOffsets`.

**Format B, pixel-position map** (an object with frame size and per-frame pixel positions;
some players name the top-level fields `framesize`/`overlayCount` and nest the image
position under `images: [[x, y]]`; the converter accepts both `position: [x, y]` and the
first entry of `images`):

```jsonc
{
  "frameWidth": 124, "frameHeight": 93,          // or "framesize": [124, 93]
  "animations": {
    "Wave": { "frames": [ { "duration": 100, "position": [0, 0] }, ... ], "loop": false },
    ...
  }
}
```

Fields `sound`, `branching`, `exitBranch`, `useExitBranching` are ignored (AV-7).

**Default role mapping for classic packs** (applied when the integrator does not pass
`roles`; names that do not exist in the map are skipped):

| Role | Candidate animation names, first match wins |
|---|---|
| rest | `RestPose`, `Default`, first animation |
| idle | every name starting with `Idle` |
| greet | `Wave`, `Greeting`, `Show` |
| point.left | `GestureLeft` |
| point.right | `GestureRight` |
| point.up | `GestureUp` |
| point.down | `GestureDown` |
| point.any | `Explain`, `GetAttention` |
| think | `Thinking`, `Processing` |
| celebrate | `Congratulate` |
| exit | `GoodBye`, `Hide` |
| alert | `Alert`, `GetAttention` |

---

## 3. Progress record (persistence)

Stored by `localStorageStore(prefix)` under key `<prefix>:<tourId>` (default prefix
`virtualtour`), JSON:

```jsonc
{ "tourId": "billing-intro", "lastStepId": "save", "completedAt": "2026-01-01T00:00:00.000Z", "updatedAt": "..." }
```

Corrupt or unparsable values are treated as `null` and overwritten on the next save.
