import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileTour } from "../../src/compile";
import { normalizeTourConfig, resolveStepConfig } from "../../src/config";
import { createTour, tours } from "../../src/index";
import type { Tour } from "../../src/index";
import { setCurrentTour } from "../../src/registry";
import { engineOf } from "../../src/tour";
import { applyStateClasses, dedupeExtras, removeStateClasses, resolveExtras, spotlitClass } from "../../src/spotlight/options";
import type { StepConfig, TourConfig, TourStepLike } from "../../src/types";
import { nextFrame } from "../engine/utils";

const HTML = `
  <div id="a"><span id="a-inner"><b id="a-deep"></b></span></div>
  <div id="b"></div>
  <div id="e1" class="extra"><i id="e1-inner"></i></div>
  <div id="e2" class="extra"></div>
  <button id="outside" type="button">Outside</button>
`;

const created: Tour[] = [];

beforeEach(() => {
  document.body.innerHTML = HTML;
});

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function make(config: TourConfig): Tour {
  const tour = createTour({ animate: false, stepDefaults: { title: "Step" }, ...config });
  created.push(tour);
  return tour;
}

async function started(config: TourConfig): Promise<Tour> {
  const tour = make(config);
  await tour.start();
  await nextFrame();
  return tour;
}

function compiled(config: TourConfig, step: StepConfig = {}) {
  const n = normalizeTourConfig(config);
  const like: TourStepLike = { id: "s", config: resolveStepConfig(n, step), resolvedTarget: null };
  const out = compileTour(n, [like]);
  return { base: out.base, step: out.steps[0]! };
}

const el = (id: string) => document.getElementById(id)!;
const overlayPath = () => document.querySelector("[data-vt-overlay] path");
const clickOverlay = () => overlayPath()!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

describe("compiled overlay options", () => {
  it("dim:true maps to an overlay with the default options", () => {
    expect(compiled({ dim: true }).base).toMatchObject({
      overlay: true,
      overlayColor: "#000",
      overlayOpacity: 0.7,
      stagePadding: 10,
      stageRadius: 5,
      duration: 400,
      lockScrollParent: false,
      clipStageToScrollParents: true,
      overlayClickBehavior: "none",
    });
  });

  it("a full DimConfig reaches the engine options", () => {
    const { base } = compiled({
      dim: {
        padding: 3,
        radius: 9,
        transitionMs: 120,
        color: "#123456",
        opacity: 0.25,
        clickOutside: "exit",
        pageScroll: false,
        lockScrollParent: true,
        clipToScrollParents: false,
      },
    });
    expect(base).toMatchObject({
      overlay: true,
      stagePadding: 3,
      stageRadius: 9,
      duration: 120,
      overlayColor: "#123456",
      overlayOpacity: 0.25,
      overlayClickBehavior: "close",
      allowScroll: false,
      lockScrollParent: true,
      clipStageToScrollParents: false,
    });
  });

  it("dim:false maps to overlay:false", () => {
    expect(compiled({ dim: false }).base.overlay).toBe(false);
  });

  it("spotlight.padding reaches that step's stagePadding and the next step keeps the tour default", async () => {
    const tour = await started({
      dim: { padding: 12 },
      steps: [
        { target: "#a", spotlight: { padding: 4 } },
        { target: "#b" },
      ],
    });
    const steps = () => engineOf(tour)!.getConfig().steps!;
    expect(steps()[0]!.stagePadding).toBe(4);
    expect(steps()[1]!.stagePadding).toBeUndefined();
    expect(engineOf(tour)!.getConfig().stagePadding).toBe(12);
  });
});

describe("dedupeExtras", () => {
  it("drops an element inside the target", () => {
    expect(dedupeExtras([el("a-inner"), el("e1")], el("a"))).toEqual([el("e1")]);
  });

  it("drops an element equal to the target", () => {
    expect(dedupeExtras([el("a")], el("a"))).toEqual([]);
  });

  it("drops an element inside another extra", () => {
    expect(dedupeExtras([el("e1-inner"), el("e1"), el("e2")])).toEqual([el("e1"), el("e2")]);
  });

  it("collapses equal elements to one", () => {
    expect(dedupeExtras([el("e1"), el("e1"), el("e2")])).toEqual([el("e1"), el("e2")]);
  });

  it("keeps unrelated elements in order", () => {
    expect(dedupeExtras([el("e2"), el("b")], el("a"))).toEqual([el("e2"), el("b")]);
  });
});

describe("resolveExtras", () => {
  it("resolves every selector with querySelectorAll, without repeats", () => {
    expect(resolveExtras([".extra", "#e1"])).toEqual([el("e1"), el("e2")]);
  });

  it("throws on an invalid selector, as the engine's allowedElements lookup does", () => {
    expect(() => resolveExtras([".extra", "[[bad"])).toThrow();
    expect(() => document.querySelectorAll("[[bad")).toThrow();
  });
});

describe("state classes", () => {
  it("adds the spotlit class and spotlight.class to the target and the deduped extras, and removes them on exit", async () => {
    const tour = await started({
      dim: true,
      steps: [{ target: "#a", spotlight: { extra: [".extra", "#e1-inner", "#a-inner"], class: "mark one" } }],
    });
    for (const id of ["a", "e1", "e2"]) {
      expect(el(id).classList.contains("vt-spotlit")).toBe(true);
      expect(el(id).classList.contains("mark")).toBe(true);
      expect(el(id).classList.contains("one")).toBe(true);
    }
    for (const id of ["a-inner", "e1-inner", "b", "outside"]) expect(el(id).classList.contains("vt-spotlit")).toBe(false);
    await tour.finish();
    for (const id of ["a", "e1", "e2"]) {
      expect(el(id).classList.contains("vt-spotlit")).toBe(false);
      expect(el(id).classList.contains("mark")).toBe(false);
    }
  });

  it("uses the tour namespace", async () => {
    await started({ namespace: "demo", dim: true, steps: [{ target: "#a" }] });
    expect(el("a").classList.contains("demo-spotlit")).toBe(true);
    expect(el("a").classList.contains("vt-spotlit")).toBe(false);
    expect(spotlitClass("demo")).toBe("demo-spotlit");
  });

  it("moves the classes from one step to the next", async () => {
    const tour = await started({
      dim: true,
      steps: [{ target: "#a", spotlight: { class: "first" } }, { target: "#b" }],
    });
    expect(el("a").className).toContain("first");
    await tour.forward();
    await nextFrame();
    expect(el("a").classList.contains("vt-spotlit")).toBe(false);
    expect(el("a").classList.contains("first")).toBe(false);
    expect(el("b").classList.contains("vt-spotlit")).toBe(true);
  });

  it("makes no class mutation on an element shared by consecutive steps", async () => {
    const tour = await started({
      dim: true,
      steps: [
        { target: "#a", spotlight: { extra: ["#e1"], class: "keep" } },
        { target: "#b", spotlight: { extra: ["#e1"], class: "keep" } },
        { target: "#e1", spotlight: { class: "keep" } },
      ],
    });
    const seen: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const now = (record.target as Element).className;
        if (/spotlit|keep/.test(`${record.oldValue} ${now}`) && /vt-spotlit/.test(record.oldValue ?? "") !== /vt-spotlit/.test(now)) {
          seen.push(`${(record.target as Element).id}: ${record.oldValue} -> ${now}`);
        }
      }
    });
    observer.observe(el("e1"), { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
    await tour.forward();
    await nextFrame();
    await tour.forward();
    await nextFrame();
    await Promise.resolve();
    observer.disconnect();
    expect(seen).toEqual([]);
    expect(el("e1").classList.contains("vt-spotlit")).toBe(true);
    expect(el("e1").classList.contains("keep")).toBe(true);
  });

  it("re-adds the spotlit class when something rewrites className", async () => {
    await started({ dim: true, steps: [{ target: "#a", spotlight: { class: "keep" } }] });
    el("a").className = "framework-owned";
    await Promise.resolve();
    await Promise.resolve();
    expect(el("a").classList.contains("vt-spotlit")).toBe(true);
    expect(el("a").classList.contains("keep")).toBe(true);
    expect(el("a").classList.contains("framework-owned")).toBe(true);
  });

  it("stops guarding after the classes are removed", async () => {
    const tour = await started({ dim: true, steps: [{ target: "#a" }] });
    await tour.finish();
    el("a").className = "framework-owned";
    await Promise.resolve();
    await Promise.resolve();
    expect(el("a").classList.contains("vt-spotlit")).toBe(false);
  });

  it("applyStateClasses and removeStateClasses work on bare elements", async () => {
    const added = applyStateClasses(el("b"), ["x-spotlit"]);
    expect(added).toEqual(["x-spotlit"]);
    el("b").className = "";
    await Promise.resolve();
    expect(el("b").classList.contains("x-spotlit")).toBe(true);
    removeStateClasses(el("b"), added);
    el("b").className = "";
    await Promise.resolve();
    expect(el("b").classList.contains("x-spotlit")).toBe(false);
  });

  it("keeps a class the app already had when the tour deselects, and does not re-add one the app removed", async () => {
    el("a").className = "active";
    el("b").className = "active";
    const tour = await started({
      dim: true,
      steps: [{ target: "#a", spotlight: { class: "active" } }, { target: "#b", spotlight: { class: "active" } }],
    });
    el("a").classList.remove("active");
    await Promise.resolve();
    await Promise.resolve();
    expect(el("a").classList.contains("active")).toBe(false);
    await tour.forward();
    await nextFrame();
    expect(el("b").classList.contains("active")).toBe(true);
    await tour.finish();
    expect(el("b").classList.contains("active")).toBe(true);
    expect(el("b").classList.contains("vt-spotlit")).toBe(false);
  });

  it("guards are per owner: a second owner on the same element does not disturb the first", async () => {
    const first = {};
    const second = {};
    const one = applyStateClasses(el("b"), ["x-spotlit"], first);
    const two = applyStateClasses(el("b"), ["y-spotlit"], second);
    removeStateClasses(el("b"), two, second);
    el("b").className = "";
    await Promise.resolve();
    expect(el("b").classList.contains("x-spotlit")).toBe(true);
    removeStateClasses(el("b"), one, first);
    el("b").className = "";
    await Promise.resolve();
    expect(el("b").classList.contains("x-spotlit")).toBe(false);
  });

  it("a tour that replaces another on the same element keeps guarding its own class", async () => {
    const first = await started({ dim: true, steps: [{ target: "#a" }] });
    const second = make({ namespace: "other", dim: true, steps: [{ target: "#a" }] });
    await second.start();
    await nextFrame();
    expect(el("a").classList.contains("other-spotlit")).toBe(true);
    await first.finish();
    el("a").className = "framework-owned";
    await Promise.resolve();
    await Promise.resolve();
    expect(el("a").classList.contains("other-spotlit")).toBe(true);
    expect(el("a").classList.contains("vt-spotlit")).toBe(false);
  });

  it("marks an extra that appears after the step shows once the popover repositions", async () => {
    const tour = await started({ dim: true, steps: [{ target: "#a", spotlight: { extra: [".late"] } }] });
    const late = document.createElement("div");
    late.className = "late";
    document.body.append(late);
    expect(late.classList.contains("vt-spotlit")).toBe(false);
    tour.refresh();
    await nextFrame();
    expect(late.classList.contains("vt-spotlit")).toBe(true);
    await tour.finish();
    expect(late.classList.contains("vt-spotlit")).toBe(false);
  });

  it("moves the classes to a target the engine re-binds after the app replaces it", async () => {
    const tour = await started({ dim: true, steps: [{ target: "#a", spotlight: { class: "mark" } }] });
    const old = el("a");
    const fresh = document.createElement("div");
    fresh.id = "a";
    old.replaceWith(fresh);
    for (let i = 0; i < 12 && !fresh.classList.contains("vt-spotlit"); i++) {
      tour.refresh();
      await nextFrame();
    }
    expect(fresh.classList.contains("vt-spotlit")).toBe(true);
    expect(fresh.classList.contains("mark")).toBe(true);
    await tour.finish();
    expect(fresh.classList.contains("vt-spotlit")).toBe(false);
  });

  it("endRun releases the classes on its own when the engine's deselect hook does nothing", async () => {
    const tour = await started({ dim: true, steps: [{ target: "#a", spotlight: { extra: ["#e1"], class: "mark" } }] });
    const engine = engineOf(tour)!;
    engine.setConfig({ ...engine.getConfig(), onDeselected: () => undefined });
    await tour.finish();
    for (const id of ["a", "e1"]) {
      expect(el(id).classList.contains("vt-spotlit")).toBe(false);
      expect(el(id).classList.contains("mark")).toBe(false);
    }
  });

  it("the deselect hook releases the classes on its own when the run is not ending", async () => {
    const tour = await started({ dim: true, steps: [{ target: "#a", spotlight: { extra: ["#e1"], class: "mark" } }] });
    const engine = engineOf(tour)!;
    const driveStep = engine.getConfig().steps![0]!;
    engine.getConfig().onDeselected!(el("a"), driveStep, { reason: "close" } as never);
    for (const id of ["a", "e1"]) {
      expect(el(id).classList.contains("vt-spotlit")).toBe(false);
      expect(el(id).classList.contains("mark")).toBe(false);
    }
  });

  it("after dropping the displayed step a reposition does not re-mark the active element with the previous step's classes", async () => {
    const tour = await started({
      dim: true,
      steps: [
        { id: "zero", target: "#b", spotlight: { class: "zero" } },
        { id: "one", target: "#a", spotlight: { class: "one" } },
        { id: "two", target: "#late", waitFor: 2000, spotlight: { class: "two" } },
      ],
    });
    await tour.forward();
    await nextFrame();
    const engine = engineOf(tour)!;
    tour.dropStep("one");
    engine.getConfig().onReposition!({} as never, {} as never);
    expect(el("a").classList.contains("zero")).toBe(false);
    expect(el("b").classList.contains("zero")).toBe(false);
  });

  it("a bad extra selector neither breaks navigation nor reposition, and the target is still marked", async () => {
    const tour = make({
      dim: true,
      steps: [{ target: "#a", spotlight: { extra: ["[[bad"], class: "mark" } }, { target: "#b" }],
    });
    await tour.start().catch(() => undefined);
    await nextFrame();
    expect(el("a").classList.contains("vt-spotlit")).toBe(true);
    expect(el("a").classList.contains("mark")).toBe(true);
    expect(() => tour.refresh()).not.toThrow();
    await nextFrame();
    await tour.forward();
    await nextFrame();
    expect(el("b").classList.contains("vt-spotlit")).toBe(true);
  });

  it("releases the classes when the current step is hidden", async () => {
    const tour = await started({ dim: true, steps: [{ target: "#a" }, { target: "#b" }] });
    expect(el("a").classList.contains("vt-spotlit")).toBe(true);
    const engine = engineOf(tour)!;
    engine.setConfig({ ...engine.getConfig(), onDeselected: () => undefined });
    tour.hideCurrent();
    expect(el("a").classList.contains("vt-spotlit")).toBe(false);
  });

  it("releases the classes when the visible step is dropped", async () => {
    const tour = await started({ dim: true, steps: [{ id: "one", target: "#a" }, { id: "two", target: "#b" }] });
    const engine = engineOf(tour)!;
    engine.setConfig({ ...engine.getConfig(), onDeselected: () => undefined });
    tour.dropStep("one");
    expect(el("a").classList.contains("vt-spotlit")).toBe(false);
    await nextFrame();
    await nextFrame();
    expect(el("b").classList.contains("vt-spotlit")).toBe(true);
  });

  it("an extra that contains the target gets the classes along with the target", async () => {
    await started({ dim: true, steps: [{ target: "#a-inner", spotlight: { extra: ["#a"], class: "mark" } }] });
    for (const id of ["a", "a-inner"]) {
      expect(el(id).classList.contains("vt-spotlit")).toBe(true);
      expect(el(id).classList.contains("mark")).toBe(true);
    }
  });

  it("marks the target and shows the popover with dim:false and no overlay", async () => {
    await started({ dim: false, steps: [{ target: "#a", title: "A", spotlight: { extra: ["#e1"] } }] });
    expect(document.querySelector("[data-vt-overlay]")).toBeNull();
    expect(document.body.hasAttribute("data-vt-dim")).toBe(false);
    expect(el("a").classList.contains("vt-spotlit")).toBe(true);
    expect(el("a").hasAttribute("data-vt-target")).toBe(true);
    expect(el("e1").classList.contains("vt-spotlit")).toBe(true);
    expect((document.querySelector(".vt-popover") as HTMLElement).style.left).toMatch(/px$/);
  });
});

describe("targetInteractive", () => {
  it("false blocks the target with dim:true and dim:false", async () => {
    for (const dim of [true, false]) {
      const tour = await started({ dim, steps: [{ target: "#a", spotlight: { targetInteractive: false } }] });
      expect(engineOf(tour)!.getConfig().steps![0]!.disableActiveInteraction).toBe(true);
      expect(el("a").hasAttribute("data-vt-blocked")).toBe(true);
      await tour.finish();
      expect(el("a").hasAttribute("data-vt-blocked")).toBe(false);
    }
  });

  it("hover-only blocks clicks with dim:false", async () => {
    const tour = await started({ dim: false, steps: [{ target: "#a", spotlight: { targetInteractive: "hover-only" } }] });
    expect(engineOf(tour)!.getConfig().steps![0]!.disableActiveInteraction).toBe("clicks");
    expect(document.querySelector("[data-vt-overlay]")).toBeNull();
  });
});

describe("clickOutside", () => {
  const steps = [{ target: "#a" }, { target: "#b" }];

  it("none leaves the tour where it is", async () => {
    const tour = await started({ dim: { clickOutside: "none" }, steps });
    clickOverlay();
    await nextFrame();
    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep?.id).toBe(tour.steps[0]!.id);
  });

  it("exit ends the tour", async () => {
    const tour = await started({ dim: { clickOutside: "exit" }, steps });
    const reasons: string[] = [];
    tour.on("exited", (p) => reasons.push(p.reason));
    clickOverlay();
    await nextFrame();
    expect(tour.isRunning()).toBe(false);
    expect(reasons).toEqual(["overlay"]);
  });

  it("exit applies the exit prompt", async () => {
    const prompt = vi.fn(() => false);
    const tour = await started({ dim: { clickOutside: "exit" }, exitPrompt: prompt, steps });
    clickOverlay();
    await nextFrame();
    await Promise.resolve();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(tour.isRunning()).toBe(true);
  });

  it("forward moves to the next step", async () => {
    const tour = await started({ dim: { clickOutside: "forward" }, steps });
    clickOverlay();
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe(tour.steps[1]!.id));
  });
});
