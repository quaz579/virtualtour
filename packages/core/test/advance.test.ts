import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listenForAdvance } from "../src/advance/auto-advance";
import { compileTour } from "../src/compile";
import { normalizeTourConfig } from "../src/config";
import { createTour, tours } from "../src/index";
import type { Tour } from "../src/index";
import { setCurrentTour } from "../src/registry";
import type { StepConfig, TourConfig } from "../src/types";
import { tick } from "./engine/utils";

const created: Tour[] = [];

beforeEach(() => {
  document.body.innerHTML = '<button id="save" type="button">Save</button><button id="other" type="button">Other</button><input id="field" />';
});

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function make(steps: StepConfig[], config: TourConfig = {}): Tour {
  const tour = createTour({ animate: false, steps, ...config });
  created.push(tour);
  return tour;
}

const click = (selector: string) => document.querySelector<HTMLElement>(selector)?.click();

describe("listenForAdvance", () => {
  it("fires once for a matching target and ignores the rest", () => {
    const onAdvance = vi.fn();
    const detach = listenForAdvance("#save", "click", onAdvance);
    click("#other");
    expect(onAdvance).not.toHaveBeenCalled();
    click("#save");
    click("#save");
    expect(onAdvance).toHaveBeenCalledTimes(1);
    detach();
  });

  it("matches a descendant of the selector", () => {
    document.body.innerHTML = '<div id="panel"><span id="inner">x</span></div>';
    const onAdvance = vi.fn();
    listenForAdvance("#panel", "click", onAdvance);
    click("#inner");
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("survives stopPropagation on the target", () => {
    const onAdvance = vi.fn();
    listenForAdvance("#save", "click", onAdvance);
    document.querySelector("#save")?.addEventListener("click", (e) => e.stopPropagation());
    click("#save");
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("listens for every event in a list", () => {
    const onAdvance = vi.fn();
    listenForAdvance("#field", ["input", "change"], onAdvance);
    document.querySelector("#field")?.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    document.querySelector("#field")?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("stops listening once detached", () => {
    const onAdvance = vi.fn();
    const detach = listenForAdvance("#save", "click", onAdvance);
    detach();
    click("#save");
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("ignores events whose target is not an element and invalid selectors", () => {
    const onAdvance = vi.fn();
    listenForAdvance("###", "click", onAdvance);
    listenForAdvance("#save", "click", onAdvance);
    document.dispatchEvent(new Event("click"));
    click("#other");
    expect(onAdvance).not.toHaveBeenCalled();
  });
});

describe("autoAdvance on a tour (AD-1, AD-2)", () => {
  it("a selector advances the tour once, even when the page stops propagation", async () => {
    const tour = make([
      { id: "a", autoAdvance: { event: "click", selector: "#save" } },
      { id: "b" },
      { id: "c" },
    ]);
    document.querySelector("#save")?.addEventListener("click", (e) => e.stopPropagation());
    await tour.start();
    click("#save");
    click("#save");
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("b"));
    await tick(60);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("does nothing for a click that does not match", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }]);
    await tour.start();
    click("#other");
    await tick(30);
    expect(tour.currentStep?.id).toBe("a");
  });

  it("removes the listener when the step is left", async () => {
    const tour = make([
      { id: "a", autoAdvance: { event: "click", selector: "#save" } },
      { id: "b" },
      { id: "c" },
    ]);
    await tour.start();
    await tour.forward();
    click("#save");
    await tick(30);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("removes the listener when the tour ends", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }]);
    await tour.start();
    const forward = vi.spyOn(tour, "forward");
    tour.finish();
    click("#save");
    expect(forward).not.toHaveBeenCalled();
  });

  it("arms the listener again when the step is shown again", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }]);
    await tour.start();
    click("#save");
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("b"));
    await tour.backward();
    expect(tour.currentStep?.id).toBe("a");
    click("#save");
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("b"));
  });

  it("the last step's selector advance finishes the tour", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }]);
    const finished = vi.fn();
    tour.on("finished", finished);
    await tour.start();
    click("#save");
    await vi.waitFor(() => expect(finished).toHaveBeenCalledTimes(1));
  });

  it("tours.current.forward() from page code advances the tour", async () => {
    const tour = make([{ id: "a" }, { id: "b" }]);
    await tour.start();
    await tours.current?.forward();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("compiles a target auto-advance to advanceOn", () => {
    const normalized = normalizeTourConfig({});
    const steps = [
      { id: "a", config: { target: "#save", autoAdvance: { event: "click" } }, resolvedTarget: null },
      { id: "b", config: { target: "#save", autoAdvance: { event: "input", strict: true } }, resolvedTarget: null },
      { id: "c", config: { target: "#save", autoAdvance: { event: "click", selector: "#save" } }, resolvedTarget: null },
    ];
    const compiled = compileTour(normalized, steps).steps;
    expect(compiled[0]?.advanceOn).toBe("click");
    expect(compiled[1]?.advanceOn).toEqual({ event: "input", strict: true });
    expect(compiled[2]?.advanceOn).toBeUndefined();
  });

  it("a target auto-advance moves the tour when the engine sees the event", async () => {
    const tour = make([
      { id: "a", target: "#field", autoAdvance: { event: "input" } },
      { id: "b" },
    ]);
    await tour.start();
    const field = document.querySelector<HTMLInputElement>("#field") as HTMLInputElement;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("b"));
  });
});

describe("auto-advance listener lifecycle", () => {
  const EVENT = "vt-test-advance";
  const counts = () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    return () => ({
      added: add.mock.calls.filter((c) => c[0] === EVENT).length,
      removed: remove.mock.calls.filter((c) => c[0] === EVENT).length,
    });
  };
  const fire = () => document.querySelector("#save")?.dispatchEvent(new Event(EVENT, { bubbles: true }));

  it("removes the listener when the step is left", async () => {
    const read = counts();
    const tour = make([{ id: "a", autoAdvance: { event: EVENT, selector: "#save" } }, { id: "b" }]);
    await tour.start();
    expect(read()).toEqual({ added: 1, removed: 0 });
    await tour.forward();
    expect(read()).toEqual({ added: 1, removed: 1 });
  });

  it("removes the listener when the popover is hidden", async () => {
    const read = counts();
    const tour = make([{ id: "a", autoAdvance: { event: EVENT, selector: "#save" } }, { id: "b" }]);
    await tour.start();
    tour.hideCurrent();
    expect(read()).toEqual({ added: 1, removed: 1 });
  });

  it("removes the listener when the tour ends", async () => {
    const read = counts();
    const tour = make([{ id: "a", autoAdvance: { event: EVENT, selector: "#save" } }, { id: "b" }]);
    await tour.start();
    tour.finish();
    expect(read()).toEqual({ added: 1, removed: 1 });
  });

  it("does not advance when the step is no longer current by the time the deferred move runs", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: EVENT, selector: "#save" } }, { id: "b" }, { id: "c" }]);
    await tour.start();
    fire();
    await tour.forward();
    await tick(30);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("runs the page's own handler before the tour moves", async () => {
    const order: string[] = [];
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }]);
    tour.steps[1]?.on("will-show", () => order.push("will-show"));
    document.querySelector("#save")?.addEventListener("click", () => order.push("page"));
    await tour.start();
    click("#save");
    await vi.waitFor(() => expect(order).toEqual(["page", "will-show"]));
  });

  it("dropping another step keeps the shown step's listener", async () => {
    const tour = make([
      { id: "a" },
      { id: "b", autoAdvance: { event: "click", selector: "#save" } },
      { id: "c" },
      { id: "d" },
    ]);
    await tour.start();
    await tour.forward();
    tour.dropStep("d");
    click("#save");
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("c"));
  });

  it("a deferred advance is cancelled when the step is left first", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }, { id: "c" }]);
    await tour.start();
    click("#save");
    await tour.goTo("c");
    await tick(30);
    expect(tour.currentStep?.id).toBe("c");
  });

  it("matches through the original target of an event that crossed a shadow boundary", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<button id="inner" type="button">x</button>';
    const onAdvance = vi.fn();
    listenForAdvance("#inner", "click", onAdvance);
    root.querySelector<HTMLElement>("#inner")?.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("matches a selector that targets the shadow host of the clicked element", async () => {
    const host = document.createElement("my-btn");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<button id="inner" type="button">x</button>';
    const onAdvance = vi.fn();
    listenForAdvance("my-btn", "click", onAdvance);
    root.querySelector<HTMLElement>("#inner")?.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});


describe("advance idempotence and selector validation", () => {
  it("does not double-advance when the page's own handler also calls forward()", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const tour = make([
      { id: "a", autoAdvance: { event: "click", selector: "#save" } },
      { id: "b", prepare: () => gate },
      { id: "c" },
    ]);
    document.querySelector("#save")?.addEventListener("click", () => void tour.forward());
    await tour.start();
    click("#save");
    await tick(60);
    release();
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("b"));
    await tick(60);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("does not double-advance when the page handler's forward() resolves synchronously", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }, { id: "c" }]);
    document.querySelector("#save")?.addEventListener("click", () => void tour.forward());
    await tour.start();
    click("#save");
    await tick(60);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("still advances once when the page does nothing", async () => {
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }, { id: "c" }]);
    await tour.start();
    click("#save");
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("b"));
    await tick(60);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("warns about an invalid autoAdvance selector", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make([{ id: "a", autoAdvance: { event: "click", selector: "##bad[" } }, { id: "b" }]);
    await tour.start();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("invalid autoAdvance selector"))).toBe(true);
    click("#save");
    await tick(40);
    expect(tour.currentStep?.id).toBe("a");
  });

  it("does not warn for a valid selector", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = make([{ id: "a", title: "A", autoAdvance: { event: "click", selector: "#save" } }, { id: "b" }]);
    await tour.start();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("autoAdvance selector"))).toBe(false);
  });
});
