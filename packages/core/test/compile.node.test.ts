import { describe, expect, it } from "vitest";
import { compileStepForShow, compileTour } from "../src/compile";
import { normalizeTourConfig, resolveStepConfig } from "../src/config";
import type { StepConfig, TourConfig, TourStepLike } from "../src/types";

function fakeElement(): Element {
  return { nodeType: 1 } as unknown as Element;
}

function makeStep(config: StepConfig, target: Element | null = null): TourStepLike {
  return { id: config.id ?? "s", config, resolvedTarget: target };
}

function compileOne(config: StepConfig, tour: TourConfig = {}, target: Element | null = null) {
  const n = normalizeTourConfig(tour);
  const step = makeStep(resolveStepConfig(n, config), target);
  const out = compileTour(n, [step]);
  return { base: out.base, step: out.steps[0]!, source: step };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

describe("compileTour environment", () => {
  it("runs with no DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(typeof Element).toBe("undefined");
  });

  it("is pure: equal input gives deep-equal output and the input is not modified", () => {
    const n = normalizeTourConfig({
      dim: { radius: { topLeft: 1 } },
      counter: (i, t) => `${i}/${t}`,
      labels: { next: "Go" },
    });
    const target = fakeElement();
    const steps = [
      makeStep(resolveStepConfig(n, { target: "#a", title: "A", body: ["x", "y"], spotlight: { extra: ["#e"] } }), target),
      makeStep(resolveStepConfig(n, { position: { offset: { main: 3 } }, reveal: "smooth" })),
    ];
    deepFreeze(n);
    steps.forEach((s) => deepFreeze(s.config));
    const first = compileTour(n, steps);
    const second = compileTour(n, steps);
    expect(second).toEqual(first);
    expect(second.steps[0]?.element).toBe(first.steps[0]?.element);
    expect(first.steps[0]?.data?.vt).toBe(steps[0]);
  });

  it("does not leak output objects between calls", () => {
    const n = normalizeTourConfig({});
    const steps = [makeStep(resolveStepConfig(n, { spotlight: { extra: ["#a"] } }))];
    const first = compileTour(n, steps);
    (first.steps[0]?.allowedElements as string[]).push("#b");
    expect(compileTour(n, steps).steps[0]?.allowedElements).toEqual(["#a"]);
  });

  it("emits one engine step per tour step, in order", () => {
    const n = normalizeTourConfig({});
    const steps = [makeStep({ id: "a" }), makeStep({ id: "b" }), makeStep({ id: "c" })];
    const out = compileTour(n, steps);
    expect(out.steps.map((s) => (s.data?.vt as TourStepLike).id)).toEqual(["a", "b", "c"]);
  });
});

describe("03-schemas section 1.4 rows (step fields)", () => {
  it("row target: element is a lazy function returning the resolved target", () => {
    const target = fakeElement();
    const { step } = compileOne({ target: "#x" }, {}, target);
    expect(typeof step.element).toBe("function");
    expect((step.element as () => Element)()).toBe(target);
  });

  it("row target: the element function reads the target at call time", () => {
    const n = normalizeTourConfig({});
    const live = { id: "s", config: resolveStepConfig(n, { target: "#x" }), resolvedTarget: null as Element | null };
    const compiled = compileTour(n, [live]).steps[0]!;
    const later = fakeElement();
    live.resolvedTarget = later;
    expect((compiled.element as () => Element | null)()).toBe(later);
  });

  it("row target: no target means no element", () => {
    expect(compileOne({}).step.element).toBeUndefined();
  });

  it("row title: a string becomes popover.title", () => {
    expect(compileOne({ title: "Hello" }).step.popover?.title).toBe("Hello");
  });

  it("row title: a function is evaluated by compileStepForShow, not compileTour", () => {
    const { step, source } = compileOne({ title: () => "Dynamic" });
    expect(step.popover?.title).toBeUndefined();
    expect(compileStepForShow(source).popover?.title).toBe("Dynamic");
  });

  it("row body: a string becomes popover.description", () => {
    expect(compileOne({ body: "Click <b>Save</b>." }).step.popover?.description).toBe("Click <b>Save</b>.");
  });

  it("row body: a string array becomes joined paragraphs", () => {
    expect(compileOne({ body: ["one", "two"] }).step.popover?.description).toBe("<p>one</p><p>two</p>");
  });

  it("row body: an Element leaves description unset", () => {
    expect(compileOne({ body: fakeElement() }).step.popover?.description).toBeUndefined();
  });

  it("row body: a function returning an Element leaves description unset", () => {
    const { source } = compileOne({ body: () => fakeElement() });
    expect(compileStepForShow(source).popover?.description).toBeUndefined();
  });

  it("row body: a function returning a string or array is evaluated at show time", () => {
    const text = compileOne({ body: () => "late" });
    expect(text.step.popover?.description).toBeUndefined();
    expect(compileStepForShow(text.source).popover?.description).toBe("late");
    const list = compileOne({ body: () => ["a", "b"] });
    expect(compileStepForShow(list.source).popover?.description).toBe("<p>a</p><p>b</p>");
  });

  it("row label: becomes popover.label, functions at show time", () => {
    expect(compileOne({ label: "Save step" }).step.popover?.label).toBe("Save step");
    const { step, source } = compileOne({ label: () => "Dyn" });
    expect(step.popover?.label).toBeUndefined();
    expect(compileStepForShow(source).popover?.label).toBe("Dyn");
  });

  it("row closeButton: true shows the close button", () => {
    expect(compileOne({ closeButton: true }).step.popover?.showButtons).toEqual(["next", "previous", "close"]);
  });

  it("row closeButton: false drops close from showButtons", () => {
    expect(compileOne({ closeButton: false }).step.popover?.showButtons).toEqual(["next", "previous"]);
  });

  it("row closeButton: an object label becomes closeBtnLabel", () => {
    const { step, source } = compileOne({ closeButton: { label: "Dismiss" } });
    expect(step.popover?.showButtons).toContain("close");
    expect(step.popover?.closeBtnLabel).toBe("Dismiss");
    const dyn = compileOne({ closeButton: { label: () => "Dyn" } });
    expect(dyn.step.popover?.closeBtnLabel).toBeUndefined();
    expect(compileStepForShow(dyn.source).popover?.closeBtnLabel).toBe("Dyn");
    expect(source).toBeDefined();
  });

  it("row classes: a string becomes popover.popoverClass", () => {
    expect(compileOne({ classes: "intro" }).step.popover?.popoverClass).toBe("intro");
  });

  it("row classes: an array is space-joined", () => {
    expect(compileOne({ classes: ["intro", "wide"] }).step.popover?.popoverClass).toBe("intro wide");
  });

  it("row classes: empty classes leave popoverClass unset", () => {
    expect(compileOne({ classes: [] }).step.popover?.popoverClass).toBeUndefined();
  });

  it("row position.arrow false: popover.arrow is false", () => {
    expect(compileOne({ position: { arrow: false } }).step.popover?.arrow).toBe(false);
    expect(compileOne({ position: { arrow: true } }).step.popover?.arrow).toBeUndefined();
  });

  it("row buttons: a step with buttons gets showButtons ['close']", () => {
    expect(compileOne({ buttons: [{ text: "Go", action: "forward" }] }).step.popover?.showButtons).toEqual(["close"]);
  });

  it("row buttons: buttons with closeButton false leave showButtons empty", () => {
    expect(compileOne({ buttons: [{ text: "Go", action: "forward" }], closeButton: false }).step.popover?.showButtons).toEqual([]);
  });

  it("row placement: a side and align map to popover.side and popover.align", () => {
    const popover = compileOne({ target: "#x", placement: { side: "left", align: "end" } }, {}, fakeElement()).step.popover;
    expect(popover?.side).toBe("left");
    expect(popover?.align).toBe("end");
  });

  it("row placement: absent with a target becomes side 'over'", () => {
    expect(compileOne({ target: "#x" }, {}, fakeElement()).step.popover?.side).toBe("over");
  });

  it("row placement: absent without a target leaves side unset", () => {
    expect(compileOne({}).step.popover?.side).toBeUndefined();
  });

  it("row placement: 'auto' becomes side 'auto'", () => {
    expect(compileOne({ target: "#x", placement: "auto" }, {}, fakeElement()).step.popover?.side).toBe("auto");
    expect(compileOne({ target: "#x", placement: { side: "auto" } }, {}, fakeElement()).step.popover?.side).toBe("auto");
  });

  it("row placement: side 'over' passes through", () => {
    expect(compileOne({ target: "#x", placement: { side: "over" } }, {}, fakeElement()).step.popover?.side).toBe("over");
  });

  it("row position.offset: defaults give 10 and 0", () => {
    const { step } = compileOne({});
    expect(step.popoverOffset).toBe(10);
    expect(step.popoverCrossOffset).toBe(0);
  });

  it("row position.offset: a number sets main and zeroes cross", () => {
    const { step } = compileOne({ position: { offset: 24 } });
    expect(step.popoverOffset).toBe(24);
    expect(step.popoverCrossOffset).toBe(0);
  });

  it("row position.offset: an object sets main and cross with defaults for the missing one", () => {
    expect(compileOne({ position: { offset: { main: 4, cross: 6 } } }).step).toMatchObject({ popoverOffset: 4, popoverCrossOffset: 6 });
    expect(compileOne({ position: { offset: { cross: 6 } } }).step).toMatchObject({ popoverOffset: 10, popoverCrossOffset: 6 });
  });

  it("row position.viewportPadding: becomes popoverPadding", () => {
    expect(compileOne({}).step.popoverPadding).toBe(0);
    expect(compileOne({ position: { viewportPadding: 8 } }).step.popoverPadding).toBe(8);
  });

  it("row position.boundary: becomes popoverBoundary on the step", () => {
    expect(compileOne({}).step.popoverBoundary).toBe("scrollParents");
    expect(compileOne({ position: { boundary: "viewport" } }).step.popoverBoundary).toBe("viewport");
    const tour = { stepDefaults: { position: { boundary: "viewport" as const } } };
    const out = compileOne({}, tour);
    expect(out.step.popoverBoundary).toBe("viewport");
    expect(compileOne({ position: { boundary: "scrollParents" } }, tour).step.popoverBoundary).toBe("scrollParents");
  });

  it("row position.flip and shift: become popover.flip and popover.shift", () => {
    expect(compileOne({}).step.popover).toMatchObject({ flip: true, shift: true });
    expect(compileOne({ position: { flip: false, shift: false } }).step.popover).toMatchObject({ flip: false, shift: false });
  });

  it("row position.strategy: becomes popover.strategy", () => {
    expect(compileOne({}).step.popover?.strategy).toBe("fixed");
    expect(compileOne({ position: { strategy: "absolute" } }).step.popover?.strategy).toBe("absolute");
  });

  it("row position.arrow.minInset: becomes popover.arrowMinInset", () => {
    expect(compileOne({}).step.popover?.arrowMinInset).toBe(15);
    expect(compileOne({ position: { arrow: { minInset: 30 } } }).step.popover?.arrowMinInset).toBe(30);
    expect(compileOne({ position: { arrow: true } }).step.popover?.arrowMinInset).toBe(15);
  });

  it("row position.arrow.minInset: invalid values fall back to the default", () => {
    for (const minInset of [-1, NaN, Infinity, "8" as unknown as number]) {
      expect(compileOne({ position: { arrow: { minInset } } }).step.popover?.arrowMinInset).toBe(15);
    }
    expect(compileOne({ position: { arrow: { minInset: 0 } } }).step.popover?.arrowMinInset).toBe(0);
  });

  it("row position.offset.cross: non-finite values fall back to the default", () => {
    for (const cross of [NaN, Infinity, -Infinity, "3" as unknown as number]) {
      expect(compileOne({ position: { offset: { cross } } }).step.popoverCrossOffset).toBe(0);
    }
    expect(compileOne({ position: { offset: { cross: -6 } } }).step.popoverCrossOffset).toBe(-6);
  });

  it("row spotlight.padding: becomes stagePadding only when set", () => {
    expect(compileOne({}).step.stagePadding).toBeUndefined();
    expect(compileOne({ spotlight: { padding: 6 } }).step.stagePadding).toBe(6);
  });

  it("row spotlight.radius: a number becomes stageRadius", () => {
    expect(compileOne({ spotlight: { radius: 8 } }).step.stageRadius).toBe(8);
  });

  it("row spotlight.radius: corners fill missing corners from the dim radius", () => {
    const { step } = compileOne({ spotlight: { radius: { topLeft: 1 } } }, { dim: { radius: 7 } });
    expect(step.stageRadius).toEqual({ topLeft: 1, topRight: 7, bottomRight: 7, bottomLeft: 7 });
  });

  it("row spotlight.radius: corners fill from a corner-form dim radius per corner", () => {
    const { step } = compileOne({ spotlight: { radius: { topLeft: 1 } } }, { dim: { radius: { bottomLeft: 9 } } });
    expect(step.stageRadius).toEqual({ topLeft: 1, topRight: 5, bottomRight: 5, bottomLeft: 9 });
  });

  it("row spotlight.radius: an unset topLeft falls back to the default radius", () => {
    expect(compileOne({ spotlight: { radius: { topRight: 1 } } }).step.stageRadius).toEqual({
      topLeft: 5,
      topRight: 1,
      bottomRight: 5,
      bottomLeft: 5,
    });
  });

  it("row spotlight.extra: allowedElements is a copy of the step's list", () => {
    const n = normalizeTourConfig({});
    const config = resolveStepConfig(n, { spotlight: { extra: ["#a"] } });
    const step = makeStep(config);
    const out = compileTour(n, [step]).steps[0]?.allowedElements as string[];
    out.push("#z");
    expect(config.spotlight?.extra).toEqual(["#a"]);
  });

  it("row spotlight.extra: becomes allowedElements", () => {
    expect(compileOne({ spotlight: { extra: ["#a", "#b"] } }).step.allowedElements).toEqual(["#a", "#b"]);
    expect(compileOne({}).step.allowedElements).toBeUndefined();
  });

  it("row spotlight.targetInteractive: false becomes disableActiveInteraction true", () => {
    expect(compileOne({ spotlight: { targetInteractive: false } }).step.disableActiveInteraction).toBe(true);
  });

  it("row spotlight.targetInteractive: 'hover-only' becomes 'clicks'", () => {
    expect(compileOne({ spotlight: { targetInteractive: "hover-only" } }).step.disableActiveInteraction).toBe("clicks");
  });

  it("row spotlight.targetInteractive: true leaves the engine default", () => {
    expect(compileOne({}).step.disableActiveInteraction).toBeUndefined();
  });

  it("row waitFor, whenMissing, shouldShow, prepare, revealWith: whenMissing 'skip' sets skipMissingElement", () => {
    expect(compileOne({ whenMissing: "skip" }).step.skipMissingElement).toBe(true);
    expect(compileOne({ whenMissing: "center" }).step.skipMissingElement).toBeUndefined();
  });

  it("row waitFor, shouldShow, prepare: stay out of the engine step", () => {
    const { step } = compileOne({ waitFor: 3000, shouldShow: () => true, prepare: () => undefined });
    expect(step.waitForElement).toBeUndefined();
    expect(Object.keys(step).sort()).toEqual(
      ["data", "popover", "popoverBoundary", "popoverCrossOffset", "popoverOffset", "popoverPadding"].sort()
    );
  });

  it("row waitFor, whenMissing, shouldShow, prepare, revealWith: revealWith set turns scrollIntoView off", () => {
    expect(compileOne({ revealWith: () => undefined }).step.scrollIntoView).toBe(false);
    expect(compileOne({ revealWith: () => undefined, reveal: "smooth" }).step.scrollIntoView).toBe(false);
  });

  it("row reveal: false becomes scrollIntoView false", () => {
    expect(compileOne({ reveal: false }).step.scrollIntoView).toBe(false);
  });

  it("row reveal: 'smooth' becomes a smooth behavior", () => {
    expect(compileOne({ reveal: "smooth" }).step.scrollIntoView).toEqual({ behavior: "smooth" });
  });

  it("row reveal: true leaves the engine default", () => {
    expect(compileOne({ reveal: true }).step.scrollIntoView).toBeUndefined();
    expect(compileOne({}).step.scrollIntoView).toBeUndefined();
  });

  it("row reveal: an options object is copied", () => {
    const options = { behavior: "smooth", block: "start" } as const;
    const out = compileOne({ reveal: options }).step.scrollIntoView;
    expect(out).toEqual(options);
    expect(out).not.toBe(options);
  });

  it("row autoAdvance without selector: becomes advanceOn", () => {
    expect(compileOne({ autoAdvance: { event: "click" } }).step.advanceOn).toBe("click");
    expect(compileOne({ autoAdvance: { event: ["click", "keyup"] } }).step.advanceOn).toEqual(["click", "keyup"]);
  });

  it("row autoAdvance without selector: strict gives the object form", () => {
    expect(compileOne({ autoAdvance: { event: "click", strict: true } }).step.advanceOn).toEqual({ event: "click", strict: true });
    expect(compileOne({ autoAdvance: { event: "click", strict: false } }).step.advanceOn).toEqual({ event: "click", strict: false });
  });

  it("row autoAdvance with selector: leaves advanceOn unset", () => {
    expect(compileOne({ autoAdvance: { event: "click", selector: "#save" } }).step.advanceOn).toBeUndefined();
  });

  it("row instruction: becomes popover.instruction, functions at show time", () => {
    expect(compileOne({ instruction: "Click Save." }).step.popover?.instruction).toBe("Click Save.");
    const { step, source } = compileOne({ instruction: () => "Dyn" });
    expect(step.popover?.instruction).toBeUndefined();
    expect(compileStepForShow(source).popover?.instruction).toBe("Dyn");
  });

  it("row instruction: left for the engine sink to sanitize, so an emptying sanitizer cannot un-gate the step", () => {
    const sanitize = (): string => "";
    expect(compileOne({ instruction: "<b>Go</b>" }, { sanitize }).step.popover?.instruction).toBe("<b>Go</b>");
  });

  it("row buttons: arrow keys keep navigating while the buttons hide Next and Back", () => {
    expect(compileOne({ buttons: [{ text: "Go", action: "forward" }] }).step.popover?.navigateWithKeys).toEqual({ next: true, prev: false });
    expect(compileOne({ buttons: [{ text: "Back", action: "backward" }] }).step.popover?.navigateWithKeys).toEqual({ next: false, prev: true });
    expect(
      compileOne({ buttons: [{ text: "Back", action: "backward" }, { text: "Go", action: "forward" }] }).step.popover?.navigateWithKeys
    ).toEqual({ next: true, prev: true });
    expect(compileOne({}).step.popover?.navigateWithKeys).toBeUndefined();
    expect(compileOne({ buttons: [{ text: "End", action: "finish" }, { text: "Run", action: () => {} }] }).step.popover?.navigateWithKeys).toBeUndefined();
  });

  it("row advanceDelay: becomes advanceDelay", () => {
    expect(compileOne({ advanceDelay: 600 }).step.advanceDelay).toBe(600);
    expect(compileOne({}).step.advanceDelay).toBeUndefined();
  });

  it("row focus: compiles to nothing", () => {
    const a = { ...compileOne({ focus: "dialog" }).step, data: undefined };
    const b = { ...compileOne({ focus: "first-button" }).step, data: undefined };
    expect(b).toEqual(a);
  });

  it("row meta, extensions, id: the step is reachable through data.vt", () => {
    const { step, source } = compileOne({ id: "save", meta: { a: 1 }, extensions: { avatar: { animation: "wave" } } });
    expect(step.data?.vt).toBe(source);
  });
});

describe("03-schemas section 1.4 rows (tour fields)", () => {
  it("row counter: false hides progress, true shows it with the engine text", () => {
    expect(compileOne({}, { counter: false }).base.showProgress).toBe(false);
    const on = compileOne({}, { counter: true });
    expect(on.base.showProgress).toBe(true);
    expect(on.step.popover?.progressText).toBeUndefined();
  });

  it("row counter: a function shows progress and sets progressText per step with a 1-based index", () => {
    const n = normalizeTourConfig({ counter: (i, t) => `Step ${i} of ${t}` });
    const steps = [makeStep({}), makeStep({}), makeStep({})];
    const out = compileTour(n, steps);
    expect(out.base.showProgress).toBe(true);
    expect(out.steps.map((s) => s.popover?.progressText)).toEqual(["Step 1 of 3", "Step 2 of 3", "Step 3 of 3"]);
  });

  it("row TourConfig.dim false: overlay is false", () => {
    expect(compileOne({}, { dim: false }).base.overlay).toBe(false);
    expect(compileOne({}, {}).base.overlay).toBe(false);
  });

  it("row TourConfig.dim true: overlay is true with the engine defaults", () => {
    expect(compileOne({}, { dim: true }).base).toMatchObject({
      overlay: true,
      stagePadding: 10,
      stageRadius: 5,
      duration: 400,
      overlayColor: "#000",
      overlayOpacity: 0.7,
      overlayClickBehavior: "none",
      allowScroll: true,
      lockScrollParent: false,
      clipStageToScrollParents: true,
    });
  });

  it("row DimConfig fields: map to the engine keys", () => {
    const { base } = compileOne(
      {},
      {
        dim: {
          padding: 3,
          radius: { topLeft: 0 },
          transitionMs: 100,
          color: "#123",
          opacity: 0.4,
          clickOutside: "forward",
          pageScroll: false,
          lockScrollParent: true,
          clipToScrollParents: false,
        },
      }
    );
    expect(base).toMatchObject({
      stagePadding: 3,
      stageRadius: { topLeft: 0, topRight: 5, bottomRight: 5, bottomLeft: 5 },
      duration: 100,
      overlayColor: "#123",
      overlayOpacity: 0.4,
      overlayClickBehavior: "nextStep",
      allowScroll: false,
      lockScrollParent: true,
      clipStageToScrollParents: false,
    });
  });

  it("row DimConfig.clickOutside: none, exit and forward map to none, close and nextStep", () => {
    expect(compileOne({}, { dim: { clickOutside: "none" } }).base.overlayClickBehavior).toBe("none");
    expect(compileOne({}, { dim: { clickOutside: "exit" } }).base.overlayClickBehavior).toBe("close");
    expect(compileOne({}, { dim: { clickOutside: "forward" } }).base.overlayClickBehavior).toBe("nextStep");
  });

  it("row TourConfig.mountIn and dimMountIn: pass through", () => {
    const mount = fakeElement();
    const dimMount = () => fakeElement();
    const { base } = compileOne({}, { mountIn: mount, dimMountIn: dimMount });
    expect(base.mountIn).toBe(mount);
    expect(base.dimMountIn).toBe(dimMount);
    expect("mountIn" in compileOne({}).base).toBe(false);
  });

  it("row TourConfig.namespace: becomes namespace", () => {
    expect(compileOne({}).base.namespace).toBe("vt");
    expect(compileOne({}, { namespace: "acme" }).base.namespace).toBe("acme");
  });

  it("row TourConfig.keys: become allowEscape and allowArrowKeys", () => {
    expect(compileOne({}).base).toMatchObject({ allowEscape: true, allowArrowKeys: true });
    expect(compileOne({}, { keys: { escape: false } }).base).toMatchObject({ allowEscape: false, allowArrowKeys: true });
    expect(compileOne({}, { keys: { arrows: false } }).base).toMatchObject({ allowEscape: true, allowArrowKeys: false });
  });

  it("labels: become the engine button texts", () => {
    expect(compileOne({}).base).toMatchObject({ nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Done", closeBtnLabel: "Close" });
    expect(compileOne({}, { labels: { next: "Go", close: "Shut" } }).base).toMatchObject({ nextBtnText: "Go", closeBtnLabel: "Shut" });
  });

  it("animate: becomes animate", () => {
    expect(compileOne({}).base.animate).toBe(true);
    expect(compileOne({}, { animate: false }).base.animate).toBe(false);
  });

  it("stepDefaults flow into every compiled step", () => {
    const n = normalizeTourConfig({ stepDefaults: { classes: "shared", position: { offset: 2 } } });
    const out = compileTour(n, [makeStep({ title: "a" }), makeStep({ title: "b", classes: "own" })]);
    expect(out.steps[0]?.popover?.popoverClass).toBe("shared");
    expect(out.steps[1]?.popover?.popoverClass).toBe("own");
    expect(out.steps[1]?.popoverOffset).toBe(2);
  });
});

describe("compileStepForShow", () => {
  it("uses the supplied dim radius for partial corner radii, matching compileTour", () => {
    const n = normalizeTourConfig({ dim: { radius: 7 } });
    const step = makeStep(resolveStepConfig(n, { spotlight: { radius: { topLeft: 1 } } }));
    const fromTour = compileTour(n, [step]).steps[0]?.stageRadius;
    expect(fromTour).toEqual({ topLeft: 1, topRight: 7, bottomRight: 7, bottomLeft: 7 });
    expect(compileStepForShow(step, n.dimOptions.radius).stageRadius).toEqual(fromTour);
  });

  it("matches the compileTour step when nothing is function-valued", () => {
    const n = normalizeTourConfig({});
    const step = makeStep(resolveStepConfig(n, { target: "#x", title: "T", body: "B", spotlight: { padding: 4 } }), fakeElement());
    expect(compileStepForShow(step)).toEqual(compileTour(n, [step]).steps[0]);
  });
});
