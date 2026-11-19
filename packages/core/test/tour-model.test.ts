import { afterEach, describe, expect, it, vi } from "vitest";
import createTourDefault, { createTour, Tour, TourNavigationError, TourStep } from "../src/index";
import { normalizedConfigOf, presenterOf, releasePresenter, setCurrentIndex } from "../src/tour";
import { markHidden, markShown, resetStep, retireStep } from "../src/step";
import type { ButtonContext, TourLike, TourStepLike } from "../src/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ids = (tour: Tour) => tour.steps.map((s) => s.id);

describe("createTour", () => {
  it("is the default export", () => {
    expect(createTourDefault).toBe(createTour);
    expect(createTour()).toBeInstanceOf(Tour);
  });

  it("creates every step eagerly without a DOM", () => {
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    const tour = createTour({ name: "Intro", steps: [{ id: "a", target: "#a" }, { title: "B" }] });
    expect(tour.steps).toHaveLength(2);
    expect(tour.steps[0]).toBeInstanceOf(TourStep);
    expect(tour.steps[1]!.config.title).toBe("B");
  });

  it("uses the name for the id and keeps an explicit id", () => {
    expect(createTour({ name: "Intro" }).id).toMatch(/^intro-/);
    expect(createTour({ id: "fixed" }).id).toBe("fixed");
    expect(createTour({ name: "Intro" }).name).toBe("Intro");
    expect(createTour().name).toBeUndefined();
  });

  it("gives steps without an id sequential ids and keeps explicit ones", () => {
    const tour = createTour({ steps: [{}, { id: "x" }, {}] });
    expect(ids(tour)).toEqual(["step-1", "x", "step-2"]);
  });

  it("skips a generated id that an explicit id already took", () => {
    const tour = createTour({ steps: [{ id: "step-1" }, {}] });
    expect(ids(tour)).toEqual(["step-1", "step-2"]);
  });

  it("skips a generated id that a later explicit id will take", () => {
    const tour = createTour({ steps: [{}, { id: "step-1" }, {}] });
    expect(ids(tour)).toEqual(["step-2", "step-1", "step-3"]);
  });

  it("rejects duplicate step ids", () => {
    expect(() => createTour({ steps: [{ id: "a" }, { id: "a" }] })).toThrow(TourNavigationError);
  });

  it("merges stepDefaults under each step and records the step id in its config", () => {
    const tour = createTour({
      stepDefaults: { whenMissing: "skip", position: { flip: false } },
      steps: [{ position: { offset: 4 } }],
    });
    const step = tour.steps[0]!;
    expect(step.config.whenMissing).toBe("skip");
    expect(step.config.position).toMatchObject({ flip: false, offset: 4, shift: true });
    expect(step.config.closeButton).toBe(true);
    expect(step.config.id).toBe("step-1");
  });

  it("does not share config objects between the definition and the step", () => {
    const def = { position: { offset: 4 } };
    const step = createTour({ steps: [def] }).steps[0]!;
    expect(step.config.position).not.toBe(def.position);
  });

  it("keeps the initial state idle", () => {
    const tour = createTour({ steps: [{}] });
    expect(tour.isRunning()).toBe(false);
    expect(tour.currentStep).toBeNull();
    expect(tour.steps[0]!.element).toBeUndefined();
    expect(tour.steps[0]!.resolvedTarget).toBeNull();
    expect(tour.steps[0]!.isShown()).toBe(false);
  });

  it("satisfies the structural tour and step shapes", () => {
    const tour = createTour({ steps: [{}] });
    const tourLike: TourLike = tour;
    const stepLike: TourStepLike = tour.steps[0]!;
    const ctx: ButtonContext = { tour, step: tour.steps[0]! };
    expect(tourLike.id).toBe(tour.id);
    expect(stepLike.id).toBe("step-1");
    expect(ctx.step.tour).toBe(tour);
  });

  it("throws the namespace error for an invalid namespace", () => {
    expect(() => createTour({ namespace: "1bad" })).toThrow(/Invalid namespace/);
  });
});

describe("stepById", () => {
  it("finds a step by id and returns undefined for an unknown id", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    expect(tour.stepById("b")).toBe(tour.steps[1]);
    expect(tour.stepById("nope")).toBeUndefined();
  });
});

describe("appendStep", () => {
  it("adds at the end by default and returns the new step", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    const added = tour.appendStep({ id: "c" });
    expect(added.id).toBe("c");
    expect(added.tour).toBe(tour);
    expect(ids(tour)).toEqual(["a", "b", "c"]);
  });

  it("adds at an index", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    tour.appendStep({ id: "x" }, 1);
    tour.appendStep({ id: "first" }, 0);
    tour.appendStep({ id: "last" }, 4);
    expect(ids(tour)).toEqual(["first", "a", "x", "b", "last"]);
  });

  it("adds before a step id", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    tour.appendStep({ id: "x" }, "b");
    tour.appendStep({ id: "y" }, "a");
    expect(ids(tour)).toEqual(["y", "a", "x", "b"]);
  });

  it("applies stepDefaults to the added step", () => {
    const tour = createTour({ stepDefaults: { whenMissing: "skip" } });
    expect(tour.appendStep({}).config.whenMissing).toBe("skip");
  });

  it.each([-1, 3, 1.5, Number.NaN])("rejects the index %s", (at) => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    expect(() => tour.appendStep({}, at)).toThrow(TourNavigationError);
    expect(ids(tour)).toEqual(["a", "b"]);
  });

  it("rejects an unknown anchor id and a duplicate id without changing the tour", () => {
    const tour = createTour({ steps: [{ id: "a" }] });
    expect(() => tour.appendStep({}, "nope")).toThrow(TourNavigationError);
    expect(() => tour.appendStep({ id: "a" })).toThrow(TourNavigationError);
    expect(ids(tour)).toEqual(["a"]);
  });

  it("generates ids that never collide after drops", () => {
    const tour = createTour({ steps: [{}, {}] });
    tour.dropStep("step-1");
    expect(tour.appendStep({}).id).toBe("step-3");
  });
});

describe("dropStep", () => {
  it("removes by id", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    tour.dropStep("b");
    expect(ids(tour)).toEqual(["a", "c"]);
    expect(tour.stepById("b")).toBeUndefined();
  });

  it("removes by instance", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    tour.dropStep(tour.steps[0]!);
    expect(ids(tour)).toEqual(["b"]);
  });

  it("ignores an unknown id and a step of another tour", () => {
    const tour = createTour({ steps: [{ id: "a" }] });
    const other = createTour({ steps: [{ id: "a" }] });
    tour.dropStep("nope");
    tour.dropStep(other.steps[0]!);
    expect(ids(tour)).toEqual(["a"]);
    expect(ids(other)).toEqual(["a"]);
  });

  it("retires the dropped step without emitting events", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }] });
    const dropped = tour.steps[0]!;
    const seen = vi.fn();
    dropped.on("disposed", seen);
    tour.dropStep(dropped);
    expect(seen).not.toHaveBeenCalled();
    expect(dropped.element).toBeNull();
    dropped.dispose();
    expect(seen).not.toHaveBeenCalled();
  });

  it("keeps currentStep pointing at the same step when earlier steps change", () => {
    const tour = createTour({ steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    setCurrentIndex(tour, 1);
    expect(tour.currentStep!.id).toBe("b");
    tour.appendStep({ id: "x" }, 0);
    expect(tour.currentStep!.id).toBe("b");
    tour.dropStep("a");
    expect(tour.currentStep!.id).toBe("b");
    tour.dropStep("b");
    expect(tour.currentStep).toBeNull();
  });
});

describe("TourStep", () => {
  it("tracks element, target and shown state", () => {
    const step = createTour({ steps: [{}] }).steps[0]!;
    const el = document.createElement("div");
    const target = document.createElement("button");
    markShown(step, el, target);
    expect(step.element).toBe(el);
    expect(step.resolvedTarget).toBe(target);
    expect(step.isShown()).toBe(true);
    markHidden(step);
    expect(step.isShown()).toBe(false);
    expect(step.element).toBe(el);
    resetStep(step);
    expect(step.element).toBeUndefined();
    expect(step.resolvedTarget).toBeNull();
  });

  it("dispose clears element and target, emits disposed once, and a new show re-arms it", () => {
    const step = createTour({ steps: [{}] }).steps[0]!;
    const seen = vi.fn();
    step.on("disposed", seen);
    markShown(step, document.createElement("div"), document.createElement("p"));
    step.dispose();
    step.dispose();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ step });
    expect(step.element).toBeNull();
    expect(step.resolvedTarget).toBeNull();
    expect(step.isShown()).toBe(false);
    markShown(step, document.createElement("div"), null);
    step.dispose();
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("supports on, once and off and runs handlers with ctx", () => {
    const step = createTour({ steps: [{}] }).steps[0]!;
    const calls: string[] = [];
    const ctx = { tag: "ctx" };
    step.on("disposed", function (this: unknown) {
      calls.push((this as typeof ctx).tag);
    }, ctx);
    const once = vi.fn();
    step.once("disposed", once);
    const off = vi.fn();
    step.on("disposed", off);
    step.off("disposed", off);
    step.dispose();
    expect(calls).toEqual(["ctx"]);
    expect(once).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
  });

  it("retireStep clears listeners", () => {
    const step = createTour({ steps: [{}] }).steps[0]!;
    const seen = vi.fn();
    step.on("disposed", seen);
    retireStep(step);
    step.dispose();
    expect(seen).not.toHaveBeenCalled();
  });

  it("hide does nothing when the step is not the current one", () => {
    const tour = createTour({ steps: [{}, {}] });
    expect(() => tour.steps[1]!.hide()).not.toThrow();
  });
});

describe("presenter wiring", () => {
  it("builds the default dialog presenter lazily and once", () => {
    const tour = createTour({ steps: [{}] });
    const a = presenterOf(tour);
    expect(presenterOf(tour)).toBe(a);
    expect(a.layout).toBe("dialog");
  });

  it("uses the configured presenter factory with the tour and releases it", () => {
    const unmount = vi.fn();
    const presenter = { mount: vi.fn(), afterShow: vi.fn(), afterReposition: vi.fn(), update: vi.fn(), beforeLeave: vi.fn(), unmount };
    const factory = vi.fn(() => presenter);
    const tour = createTour({ presenter: factory });
    expect(factory).not.toHaveBeenCalled();
    expect(presenterOf(tour)).toBe(presenter);
    expect(factory).toHaveBeenCalledWith(tour, expect.objectContaining({ namespace: "vt" }));
    releasePresenter(tour);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(presenterOf(tour)).toBe(presenter);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("carries progress and presenter through normalization", () => {
    const store = { load: () => null, save: () => undefined, clear: () => undefined };
    const progress = { store };
    const presenter = () => {
      throw new Error("unused");
    };
    const n = normalizedConfigOf(createTour({ progress, presenter }));
    expect(n.progress).toBe(progress);
    expect(n.presenter).toBe(presenter);
  });
});
