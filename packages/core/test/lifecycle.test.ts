import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours, TourEnvironmentError, TourNavigationError } from "../src/index";
import type { Tour, TourStep } from "../src/index";
import type { PopoverDOM } from "../src/engine/popover/popover";
import { setCurrentTour } from "../src/registry";
import { engineOf } from "../src/tour";
import type { Presenter, StepConfig, TourConfig } from "../src/types";
import { nextFrame, pressKey, tick } from "./engine/utils";

const created: Tour[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const tour of created.splice(0)) {
    if (tour.isRunning()) tour.finish();
  }
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const stepDefs = (...ids: string[]): StepConfig[] => ids.map((id) => ({ id, title: id.toUpperCase(), body: `Body ${id}` }));

function make(config: TourConfig = {}, ids: string[] = ["a", "b", "c"]): Tour {
  const tour = createTour({ animate: false, steps: stepDefs(...ids), ...config });
  created.push(tour);
  return tour;
}

function record(tour: Tour, options: { registry?: boolean } = {}): string[] {
  const log: string[] = [];
  const stepEvents = ["will-show", "shown", "will-hide", "hidden", "finished", "exited", "disposed"] as const;
  const watch = (step: TourStep) => {
    for (const e of stepEvents) step.on(e, () => log.push(`${step.id}:${e}`));
  };
  tour.steps.forEach(watch);
  const tourEvents = ["started", "activated", "deactivated", "finished"] as const;
  for (const e of tourEvents) {
    tour.on(e, () => log.push(`tour:${e}`));
    if (options.registry) tours.on(e, (p) => p.tour === tour && log.push(`reg:${e}`));
  }
  tour.on("exited", (p) => log.push(`tour:exited ${p.reason}`));
  tour.on("step-shown", (p) => log.push(`tour:step-shown ${p.step.id} ${p.previous?.id ?? "-"}`));
  if (options.registry) {
    tours.on("exited", (p) => p.tour === tour && log.push(`reg:exited ${p.reason}`));
    tours.on("step-shown", (p) => p.tour === tour && log.push(`reg:step-shown ${p.step.id} ${p.previous?.id ?? "-"}`));
  }
  return log;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover");
const stepAttr = () => wrapper()?.getAttribute("data-vt-step");
const click = (selector: string) => document.querySelector<HTMLElement>(selector)?.click();

const START = ["tour:started", "tour:activated", "a:will-show", "a:shown", "tour:step-shown a -"];

describe("01-architecture.md §7.2 ordering", () => {
  it("start()", async () => {
    const tour = make();
    const log = record(tour, { registry: true });
    const currentAtStarted: Array<Tour | null> = [];
    tour.on("started", () => currentAtStarted.push(tours.current));

    await tour.start();

    expect(log).toEqual([
      "tour:started",
      "reg:started",
      "tour:activated",
      "reg:activated",
      "a:will-show",
      "a:shown",
      "tour:step-shown a -",
      "reg:step-shown a -",
    ]);
    expect(currentAtStarted).toEqual([tour]);
    expect(tours.current).toBe(tour);
    expect(tour.isRunning()).toBe(true);
  });

  it("show step S", async () => {
    const order: string[] = [];
    const presenter: Presenter = {
      mount: (_p, step) => order.push(`mount ${step.id}`),
      afterShow: (_p, step) => order.push(`afterShow ${step.id}`),
      afterReposition: () => undefined,
      update: () => undefined,
      beforeLeave: () => undefined,
      unmount: () => undefined,
    };
    const tour = make({ presenter: () => presenter });
    tour.steps[0]!.on("will-show", () => order.push("will-show"));
    tour.steps[0]!.on("shown", () => order.push("shown"));
    tour.on("step-shown", () => order.push("step-shown"));

    const started = tour.start().then(() => order.push("promise resolved"));
    await started;

    expect(order).toEqual(["will-show", "mount a", "afterShow a", "shown", "step-shown", "promise resolved"]);
  });

  it("navigate S → T", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour);
    await tour.forward();

    expect(log).toEqual(["a:will-hide", "a:hidden", "b:will-show", "b:shown", "tour:step-shown b a"]);
    expect(stepAttr()).toBe("1");
    expect(tour.currentStep).toBe(tour.steps[1]);
  });

  it("S shown again later", async () => {
    const tour = make();
    await tour.start();
    await tour.forward();
    const log = record(tour);
    await tour.backward();

    expect(log).toEqual(["b:will-hide", "b:hidden", "a:will-show", "a:shown", "tour:step-shown a b"]);
    expect(log.some((entry) => entry.endsWith(":disposed"))).toBe(false);
  });

  it.todo("action step S completed (step 'completed' and tour 'step-completed' arrive with the engine completion hook in V-06)");

  it("hideCurrent()", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour);
    tour.hideCurrent();

    expect(log).toEqual(["a:will-hide", "a:hidden"]);
    expect(wrapper()).toBeNull();
    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep).toBeNull();
    expect(tours.current).toBe(tour);
  });

  it("hideCurrent() then forward creates a fresh engine at the chosen index", async () => {
    const tour = make();
    await tour.start();
    tour.hideCurrent();
    const log = record(tour);
    await tour.forward();

    expect(log).toEqual(["b:will-show", "b:shown", "tour:step-shown b a"]);
    expect(stepAttr()).toBe("1");
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("hideCurrent() then goTo() with no argument shows the hidden step again", async () => {
    const tour = make();
    await tour.start();
    await tour.forward();
    tour.hideCurrent();
    await tour.goTo();

    expect(tour.currentStep?.id).toBe("b");
    expect(stepAttr()).toBe("1");
  });

  it("dropStep(S) while S is visible", async () => {
    const tour = make();
    await tour.start();
    const a = tour.steps[0]!;
    const log = record(tour);
    tour.dropStep(a);
    await tick(20);

    expect(log).toEqual(["a:will-hide", "a:hidden", "a:disposed", "b:will-show", "b:shown", "tour:step-shown b a"]);
    expect(tour.steps.map((s) => s.id)).toEqual(["b", "c"]);
    expect(tour.currentStep?.id).toBe("b");
    expect(wrapper()?.getAttribute("data-vt-step")).toBe("0");
    expect(a.element).toBeNull();
  });

  it("dropStep(S) while S is visible and a later step remains shows the step that followed it", async () => {
    const tour = make();
    await tour.start();
    await tour.forward();
    tour.dropStep("b");
    await tick(20);

    expect(tour.currentStep?.id).toBe("c");
    expect(tour.steps.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("dropStep(S) while S is visible and no step remains → exit() without prompt", async () => {
    const exitPrompt = vi.fn(() => false);
    const tour = make({ exitPrompt }, ["only"]);
    await tour.start();
    const log = record(tour);
    tour.dropStep("only");

    expect(log).toEqual(["only:will-hide", "only:hidden", "only:disposed", "tour:exited api", "tour:deactivated"]);
    expect(exitPrompt).not.toHaveBeenCalled();
    expect(tour.isRunning()).toBe(false);
    expect(wrapper()).toBeNull();
  });

  it("dropStep(S) while S is visible and it was the last step → exit() without prompt", async () => {
    const tour = make();
    await tour.start();
    await tour.goTo("c");
    const log = record(tour);
    tour.dropStep("c");

    expect(log).toEqual([
      "c:will-hide",
      "c:hidden",
      "c:disposed",
      "tour:exited api",
      "a:disposed",
      "b:disposed",
      "tour:deactivated",
    ]);
  });

  it("finish() / Done on last step", async () => {
    const tour = make();
    await tour.start();
    await tour.goTo("c");
    const log = record(tour, { registry: true });
    const currentAtDeactivated: Array<Tour | null> = [];
    tour.on("deactivated", () => currentAtDeactivated.push(tours.current));
    tour.finish();

    expect(log).toEqual([
      "c:will-hide",
      "c:hidden",
      "c:finished",
      "tour:finished",
      "reg:finished",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
      "reg:deactivated",
    ]);
    expect(currentAtDeactivated).toEqual([null]);
    expect(tours.current).toBeNull();
    expect(tour.isRunning()).toBe(false);
    expect(wrapper()).toBeNull();
    expect(document.body.hasAttribute("data-vt-active")).toBe(false);
  });

  it("finish() / Done on last step (the Done button)", async () => {
    const tour = make();
    await tour.start();
    await tour.goTo("c");
    const log = record(tour);
    expect(document.querySelector(".vt-popover-next-btn")?.textContent).toBe("Done");
    click(".vt-popover-next-btn");

    expect(log).toEqual([
      "c:will-hide",
      "c:hidden",
      "c:finished",
      "tour:finished",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
    ]);
  });

  it("exit() accepted or no prompt", async () => {
    const tour = make();
    await tour.start();
    await tour.forward();
    const log = record(tour, { registry: true });
    const result = await tour.exit();

    expect(result).toBe(true);
    expect(log).toEqual([
      "b:will-hide",
      "b:hidden",
      "b:exited",
      "tour:exited api",
      "reg:exited api",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
      "reg:deactivated",
    ]);
    expect(tours.current).toBeNull();
    expect(wrapper()).toBeNull();
  });

  it("exit() accepted or no prompt (a string prompt that is accepted)", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const tour = make({ exitPrompt: "Leave the tour?" });
    await tour.start();

    await expect(tour.exit()).resolves.toBe(true);

    expect(confirm).toHaveBeenCalledWith("Leave the tour?");
    expect(tour.isRunning()).toBe(false);
  });

  it("exit() accepted or no prompt (an async function prompt that is accepted)", async () => {
    const exitPrompt = vi.fn(async () => true);
    const tour = make({ exitPrompt });
    await tour.start();

    await expect(tour.exit()).resolves.toBe(true);

    expect(exitPrompt).toHaveBeenCalledTimes(1);
    expect(tour.isRunning()).toBe(false);
  });

  it("Escape / close button / overlay click (clickOutside: 'exit')", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const exits: string[] = [];

    const viaEscape = make({ exitPrompt: "Leave?" });
    viaEscape.on("exited", (p) => exits.push(p.reason));
    await viaEscape.start();
    pressKey("Escape");
    expect(exits).toEqual(["escape"]);
    expect(viaEscape.isRunning()).toBe(false);

    const viaClose = make({ exitPrompt: "Leave?" });
    viaClose.on("exited", (p) => exits.push(p.reason));
    await viaClose.start();
    click(".vt-popover-close-btn");
    expect(exits).toEqual(["escape", "close"]);

    const viaOverlay = make({ exitPrompt: "Leave?", dim: { clickOutside: "exit" } });
    viaOverlay.on("exited", (p) => exits.push(p.reason));
    await viaOverlay.start();
    document.querySelector("[data-vt-overlay] path")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(exits).toEqual(["escape", "close", "overlay"]);
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it("Escape with prompt declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const tour = make({ exitPrompt: "Leave?" });
    await tour.start();
    const log = record(tour);
    pressKey("Escape");

    expect(log).toEqual([]);
    expect(tour.isRunning()).toBe(true);
    expect(wrapper()).not.toBeNull();

    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("exit() prompt declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const tour = make({ exitPrompt: "Leave?" });
    await tour.start();
    const log = record(tour);

    await expect(tour.exit()).resolves.toBe(false);

    expect(log).toEqual([]);
    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep?.id).toBe("a");
  });

  it("forward past last step", async () => {
    const tour = make();
    await tour.start();
    await tour.goTo("c");
    const log = record(tour);
    await tour.forward();

    expect(log).toEqual([
      "c:will-hide",
      "c:hidden",
      "c:finished",
      "tour:finished",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
    ]);
  });

  it("backward before first step", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour);
    await tour.backward();

    expect(log).toEqual([]);
    expect(tour.currentStep?.id).toBe("a");
    expect(tour.isRunning()).toBe(true);
  });

  it("all remaining steps skipped moving forward → finished sequence", async () => {
    const tour = make({
      steps: [
        { id: "a", title: "A" },
        { id: "b", title: "B", shouldShow: () => false },
        { id: "c", title: "C", target: "#absent", whenMissing: "skip" },
      ],
    });
    await tour.start();
    const log = record(tour);
    await tour.forward();

    expect(log).toEqual([
      "a:will-hide",
      "a:hidden",
      "a:finished",
      "tour:finished",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
    ]);
    expect(tour.isRunning()).toBe(false);
  });

  it("all earlier steps skipped moving backward → exited without the prompt", async () => {
    const exitPrompt = vi.fn(() => false);
    let open = true;
    const tour = make({
      exitPrompt,
      steps: [
        { id: "a", title: "A", shouldShow: () => open },
        { id: "b", title: "B", target: "#absent", whenMissing: "skip" },
        { id: "c", title: "C" },
      ],
    });
    await tour.start();
    await tour.goTo("c");
    open = false;
    const log = record(tour);
    await tour.backward();

    expect(exitPrompt).not.toHaveBeenCalled();
    expect(log).toEqual([
      "c:will-hide",
      "c:hidden",
      "c:exited",
      "tour:exited api",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
    ]);
    expect(tour.isRunning()).toBe(false);
  });

  it("another tour starts while this one runs", async () => {
    const exitPrompt = vi.fn(() => false);
    const first = make({ exitPrompt });
    await first.start();
    const log = record(first);
    const second = make({}, ["x", "y"]);
    const secondLog = record(second);

    await second.start();

    expect(log).toEqual([
      "a:will-hide",
      "a:hidden",
      "a:exited",
      "tour:exited replaced",
      "a:disposed",
      "b:disposed",
      "c:disposed",
      "tour:deactivated",
    ]);
    expect(secondLog).toEqual(["tour:started", "tour:activated", "x:will-show", "x:shown", "tour:step-shown x -"]);
    expect(exitPrompt).not.toHaveBeenCalled();
    expect(first.isRunning()).toBe(false);
    expect(tours.current).toBe(second);
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("second tour while one runs → replaced (engine-level replacement of a tour that was hidden)", async () => {
    const first = make();
    await first.start();
    first.hideCurrent();
    const log = record(first);
    const second = make({}, ["x"]);

    await second.start();

    expect(log).toEqual(["a:exited", "tour:exited replaced", "a:disposed", "b:disposed", "c:disposed", "tour:deactivated"]);
    expect(first.isRunning()).toBe(false);
    expect(tours.current).toBe(second);
  });

  it("configure() on a shown step emits no events and keeps the wrapper", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour, { registry: true });
    const before = wrapper();
    tour.stepById("a")!.configure({ title: "Changed", body: "New body" });
    expect(log).toEqual([]);
    expect(wrapper()).toBe(before);
    expect(before!.querySelector(".vt-popover-title")!.textContent).toBe("Changed");
  });
});

describe("tour lifecycle", () => {
  it("start() while running resolves with no events", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour);

    await tour.start();

    expect(log).toEqual([]);
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("start() rejects without a browser document", async () => {
    const tour = make();
    vi.stubGlobal("document", undefined);
    await expect(tour.start()).rejects.toBeInstanceOf(TourEnvironmentError);
    expect(tour.isRunning()).toBe(false);
  });

  it("a tour with no steps starts and finishes at once", async () => {
    const tour = make({ steps: [] });
    const log = record(tour);
    await tour.start();

    expect(log).toEqual(["tour:started", "tour:activated", "tour:finished", "tour:deactivated"]);
    expect(tour.isRunning()).toBe(false);
  });

  it("resolves the promise only after the popover is in the DOM and the step is shown", async () => {
    const tour = make();
    const snapshot: Array<{ attr: string | null | undefined; shown: boolean; element: HTMLElement | null | undefined }> = [];
    await tour.start();
    const p = tour.forward();
    await p;
    snapshot.push({ attr: stepAttr(), shown: tour.steps[1]!.isShown(), element: tour.steps[1]!.element });

    expect(snapshot[0]!.attr).toBe("1");
    expect(snapshot[0]!.shown).toBe(true);
    expect(snapshot[0]!.element).toBe(wrapper());
  });

  it("tracks step state through shows, hides and the end of a run", async () => {
    const tour = make();
    const [a, b] = tour.steps as [TourStep, TourStep, TourStep];
    expect(a.element).toBeUndefined();
    await tour.start();
    expect(a.isShown()).toBe(true);
    const aElement = a.element;
    expect(aElement).toBe(wrapper());
    await tour.forward();
    expect(a.isShown()).toBe(false);
    expect(a.element).toBe(aElement);
    expect(b.isShown()).toBe(true);
    tour.finish();
    expect(a.element).toBeNull();
    expect(b.element).toBeNull();
    expect(b.isShown()).toBe(false);
  });

  it("emits disposed exactly once per step per run and a second run starts clean", async () => {
    const tour = make();
    const log = record(tour);
    await tour.start();
    await tour.forward();
    await tour.backward();
    tour.finish();
    const first = log.filter((e) => e.endsWith(":disposed"));
    expect(first).toEqual(["a:disposed", "b:disposed", "c:disposed"]);

    log.length = 0;
    await tour.start();
    expect(log).toEqual(START);
    expect(tour.steps[0]!.element).toBe(wrapper());
    tour.finish();
    expect(log.filter((e) => e.endsWith(":disposed"))).toEqual(["a:disposed", "b:disposed", "c:disposed"]);
  });

  it("clears tours.current only for the tour that ends", async () => {
    const first = make();
    await first.start();
    const second = make({}, ["x"]);
    await second.start();
    expect(tours.current).toBe(second);
    first.finish();
    expect(tours.current).toBe(second);
    second.finish();
    expect(tours.current).toBeNull();
  });

  it("exit(), finish() and hideCurrent() do nothing while no run is active", async () => {
    const tour = make();
    const log = record(tour);
    await expect(tour.exit()).resolves.toBe(true);
    expect(() => tour.finish()).not.toThrow();
    expect(() => tour.hideCurrent()).not.toThrow();
    await tour.forward();
    await tour.backward();
    expect(log).toEqual([]);
    expect(tour.isRunning()).toBe(false);
  });

  it("hideCurrent() twice hides once", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour);
    tour.hideCurrent();
    tour.hideCurrent();
    expect(log).toEqual(["a:will-hide", "a:hidden"]);
  });

  it("finish() while hidden finishes the hidden step without a second hide", async () => {
    const tour = make();
    await tour.start();
    tour.hideCurrent();
    const log = record(tour);
    tour.finish();

    expect(log).toEqual(["a:finished", "tour:finished", "a:disposed", "b:disposed", "c:disposed", "tour:deactivated"]);
  });

  it("a handler exception does not stop navigation", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tour = make();
    tour.on("step-shown", () => {
      throw new Error("handler failed");
    });
    tour.steps[1]!.on("shown", () => {
      throw new Error("step handler failed");
    });
    const seen: string[] = [];
    tour.on("step-shown", (p) => seen.push(p.step.id));

    await tour.start();
    await tour.forward();

    expect(seen).toEqual(["a", "b"]);
    expect(tour.currentStep?.id).toBe("b");
    expect(error).toHaveBeenCalled();
  });

  it("once on step-shown fires for the first step only", async () => {
    const tour = make();
    const seen: string[] = [];
    tour.once("step-shown", (p) => seen.push(p.step.id));
    await tour.start();
    await tour.forward();
    expect(seen).toEqual(["a"]);
  });

  it("keys.escape:false ignores Escape while the arrows work", async () => {
    const tour = make({ keys: { escape: false } });
    await tour.start();
    pressKey("Escape");
    expect(tour.isRunning()).toBe(true);
    pressKey("ArrowRight");
    await tick(30);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("keys.arrows:false ignores ArrowRight while Escape works", async () => {
    const tour = make({ keys: { arrows: false } });
    await tour.start();
    pressKey("ArrowRight");
    await tick(30);
    expect(tour.currentStep?.id).toBe("a");
    pressKey("Escape");
    expect(tour.isRunning()).toBe(false);
  });

  it("the arrow keys and the Next and Back buttons route through the tour", async () => {
    const tour = make();
    const log = record(tour);
    await tour.start();
    pressKey("ArrowRight");
    await tick(30);
    expect(tour.currentStep?.id).toBe("b");
    click(".vt-popover-next-btn");
    await tick(30);
    expect(tour.currentStep?.id).toBe("c");
    click(".vt-popover-prev-btn");
    await tick(30);
    pressKey("ArrowLeft");
    await tick(30);
    expect(tour.currentStep?.id).toBe("a");
    expect(log.filter((e) => e.startsWith("tour:step-shown"))).toEqual([
      "tour:step-shown a -",
      "tour:step-shown b a",
      "tour:step-shown c b",
      "tour:step-shown b c",
      "tour:step-shown a b",
    ]);
  });

  it("serializes rapid navigation: one move runs and one waits, and every caller resolves after the final step is shown", async () => {
    const tour = make({}, ["a", "b", "c", "d", "e"]);
    await tour.start();
    const resolvedAt: string[] = [];
    const track = (name: string, p: Promise<void>) => p.then(() => resolvedAt.push(`${name}@${tour.currentStep?.id}`));

    await Promise.all([
      track("f1", tour.forward()),
      track("f2", tour.forward()),
      track("f3", tour.forward()),
      track("f4", tour.forward()),
    ]);

    expect(tour.currentStep?.id).toBe("c");
    expect(resolvedAt).toHaveLength(4);
    expect(resolvedAt.filter((e) => e.endsWith("@c"))).toHaveLength(3);
  });

  it("a forward() replaced in the queue never shows its step but its caller is not left hanging", async () => {
    const tour = make({}, ["a", "b", "c", "d"]);
    await tour.start();
    const shown: string[] = [];
    tour.on("step-shown", (p) => shown.push(p.step.id));

    await Promise.all([tour.forward(), tour.forward(), tour.forward()]);

    expect(shown).toEqual(["b", "c"]);
  });

  it("exit() during a pending navigation ends the tour and settles the queued callers", async () => {
    const tour = make();
    await tour.start();
    const first = tour.forward();
    const queued = tour.forward();
    const exit = tour.exit();

    await Promise.all([first, queued, exit]);
    await tick(30);

    expect(tour.isRunning()).toBe(false);
    expect(tours.current).toBeNull();
    expect(wrapper()).toBeNull();
    await tour.start();
    expect(tour.currentStep?.id).toBe("a");
  });

  it("the run's abort signal aborts when the run ends", async () => {
    const { runSignal } = await import("../src/tour");
    const tour = make();
    expect(runSignal(tour)).toBeNull();
    await tour.start();
    const signal = runSignal(tour) as AbortSignal;
    expect(signal.aborted).toBe(false);
    tour.finish();
    expect(signal.aborted).toBe(true);
    expect(runSignal(tour)).toBeNull();
  });

  it("a second Escape while the prompt is pending does not open another prompt", async () => {
    let answer!: (value: boolean) => void;
    const exitPrompt = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        })
    );
    const tour = make({ exitPrompt });
    await tour.start();
    pressKey("Escape");
    pressKey("Escape");
    expect(exitPrompt).toHaveBeenCalledTimes(1);
    answer(true);
    await tick(10);
    expect(tour.isRunning()).toBe(false);
  });

  it("an exitPrompt that throws keeps the tour open and reports the error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tour = make({
      exitPrompt: () => {
        throw new Error("prompt failed");
      },
    });
    await tour.start();
    await expect(tour.exit()).resolves.toBe(false);
    expect(tour.isRunning()).toBe(true);
    expect(error).toHaveBeenCalled();
  });

  it("an accepted async prompt does nothing when the tour already ended", async () => {
    let answer!: (value: boolean) => void;
    const tour = make({
      exitPrompt: () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    });
    await tour.start();
    const pending = tour.exit();
    tour.finish();
    const log = record(tour);
    answer(true);
    await pending;
    expect(log).toEqual([]);
  });
});

describe("goTo", () => {
  it("shows a step by index, id and instance", async () => {
    const tour = make();
    await tour.start();
    await tour.goTo(2);
    expect(tour.currentStep?.id).toBe("c");
    await tour.goTo("a");
    expect(tour.currentStep?.id).toBe("a");
    await tour.goTo(tour.steps[1]!);
    expect(tour.currentStep?.id).toBe("b");
    expect(stepAttr()).toBe("1");
  });

  it("rejects an unknown reference without changing the run", async () => {
    const tour = make();
    await tour.start();
    await expect(tour.goTo("nope")).rejects.toBeInstanceOf(TourNavigationError);
    await expect(tour.goTo(9)).rejects.toBeInstanceOf(TourNavigationError);
    expect(tour.currentStep?.id).toBe("a");
  });

  it("does nothing when the step is already shown", async () => {
    const tour = make();
    await tour.start();
    const log = record(tour);
    await tour.goTo("a");
    expect(log).toEqual([]);
  });

  it("starts the tour at that step when none is running", async () => {
    const tour = make();
    const log = record(tour);
    await tour.goTo("b");
    expect(log).toEqual(["tour:started", "tour:activated", "b:will-show", "b:shown", "tour:step-shown b -"]);
    expect(stepAttr()).toBe("1");
  });

  it("TourStep.show() and hide() go through the tour", async () => {
    const tour = make();
    await tour.start();
    await tour.steps[2]!.show();
    expect(tour.currentStep?.id).toBe("c");
    tour.steps[2]!.hide();
    expect(tour.currentStep).toBeNull();
    expect(tour.isRunning()).toBe(true);
  });
});

describe("steps added and removed while running", () => {
  it("appendStep adds a reachable step and keeps the current index", async () => {
    const tour = make();
    await tour.start();
    await tour.forward();
    const extra = tour.appendStep({ id: "d", title: "D" }, 0);
    expect(tour.currentStep?.id).toBe("b");
    expect(tour.steps.map((s) => s.id)).toEqual(["d", "a", "b", "c"]);
    await tour.goTo(extra);
    expect(tour.currentStep).toBe(extra);
    expect(stepAttr()).toBe("0");
    const end = tour.appendStep({ id: "e", title: "E" });
    await tour.goTo("c");
    await tour.forward();
    expect(tour.currentStep).toBe(end);
  });

  it("dropStep of a step that is not visible disposes it at once and keeps the current step", async () => {
    const tour = make();
    await tour.start();
    const c = tour.steps[2]!;
    const log = record(tour);
    tour.dropStep(c);

    expect(log).toEqual(["c:disposed"]);
    expect(tour.currentStep?.id).toBe("a");
    expect(tour.steps.map((s) => s.id)).toEqual(["a", "b"]);
    await tour.forward();
    await tour.forward();
    expect(tour.isRunning()).toBe(false);
  });

  it("dropStep of an earlier step shifts the current index", async () => {
    const tour = make();
    await tour.start();
    await tour.goTo("c");
    tour.dropStep("a");
    expect(tour.currentStep?.id).toBe("c");
    await tour.backward();
    expect(tour.currentStep?.id).toBe("b");
  });
});

describe("presenter wiring", () => {
  function spyPresenter(extra: Partial<Presenter> = {}) {
    const calls: string[] = [];
    const rects: Array<{ wrapperRect: DOMRect; bubbleRect: DOMRect }> = [];
    const presenter: Presenter = {
      mount: (_p, step) => calls.push(`mount ${step.id}`),
      afterShow: (_p, step) => calls.push(`afterShow ${step.id}`),
      afterReposition: (_p, step, info) => {
        calls.push(`afterReposition ${step.id}`);
        rects.push({ wrapperRect: info.wrapperRect, bubbleRect: info.bubbleRect });
      },
      update: () => undefined,
      beforeLeave: (step) => calls.push(`beforeLeave ${step.id}`),
      unmount: () => calls.push("unmount"),
      ...extra,
    };
    return { presenter, calls, rects };
  }

  it("calls the presenter in order across a run and unmounts it once at the end", async () => {
    const { presenter, calls } = spyPresenter();
    const factory = vi.fn(() => presenter);
    const tour = make({ presenter: factory }, ["a", "b"]);

    await tour.start();
    await tour.forward();
    tour.finish();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      "mount a",
      "afterReposition a",
      "afterShow a",
      "beforeLeave a",
      "mount b",
      "afterReposition b",
      "afterShow b",
      "beforeLeave b",
      "unmount",
    ]);

    await tour.start();
    expect(factory).toHaveBeenCalledTimes(2);
    tour.finish();
  });

  it("builds the default dialog presenter when none is configured", async () => {
    const tour = make();
    await tour.start();
    expect(wrapper()?.classList.contains("vt-dialog")).toBe(true);
  });

  it("does not unmount the presenter on hideCurrent()", async () => {
    const { presenter, calls } = spyPresenter();
    const tour = make({ presenter: () => presenter });
    await tour.start();
    tour.hideCurrent();
    expect(calls).not.toContain("unmount");
    await tour.forward();
    expect(calls.filter((c) => c.startsWith("mount"))).toEqual(["mount a", "mount b"]);
  });

  it("fills bubbleRect with the wrapper rect when the popover has no bubble", async () => {
    const { presenter, rects } = spyPresenter();
    const tour = make({ presenter: () => presenter });
    await tour.start();

    expect(rects).toHaveLength(1);
    expect(rects[0]!.bubbleRect).toBe(rects[0]!.wrapperRect);
  });

  it("fills bubbleRect from the .vt-bubble element when the layout has one", async () => {
    const marker = new DOMRect(1, 2, 3, 4);
    const { presenter, rects } = spyPresenter({
      layout: "speaker",
      mount: (popover: PopoverDOM) => {
        popover.bubble!.getBoundingClientRect = () => marker;
      },
    });
    const tour = make({ presenter: () => presenter });
    await tour.start();

    expect(rects[0]!.bubbleRect).toBe(marker);
    expect(rects[0]!.wrapperRect).not.toBe(marker);
  });

  it("refresh() repositions through the presenter while running and does nothing otherwise", async () => {
    const { presenter, calls } = spyPresenter();
    const tour = make({ presenter: () => presenter });
    expect(() => tour.refresh()).not.toThrow();
    await tour.start();
    const before = calls.filter((c) => c.startsWith("afterReposition")).length;
    tour.refresh();
    await nextFrame();
    await nextFrame();
    expect(calls.filter((c) => c.startsWith("afterReposition")).length).toBeGreaterThan(before);
  });

  it("a presenter that throws does not break the show or the run", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom = () => {
      throw new Error("presenter failed");
    };
    const { presenter } = spyPresenter({ mount: boom, afterShow: boom, afterReposition: boom, beforeLeave: boom });
    const tour = make({ presenter: () => presenter });
    const log = record(tour);

    await tour.start();
    await tour.forward();

    expect(tour.currentStep?.id).toBe("b");
    expect(log).toContain("b:shown");
    expect(wrapper()).not.toBeNull();
    expect(error).toHaveBeenCalled();
  });
});

describe("compiled step content", () => {
  it("evaluates function-valued titles at show time and renders the counter", async () => {
    let n = 0;
    const tour = createTour({
      animate: false,
      counter: (index, total) => `${index}/${total}`,
      steps: [{ id: "a", title: () => `Run ${++n}` }, { id: "b", title: "Fixed" }],
    });
    created.push(tour);
    await tour.start();
    expect(document.querySelector(".vt-popover-title")?.textContent).toBe("Run 1");
    expect(document.querySelector(".vt-popover-progress-text")?.textContent).toBe("1/2");
    await tour.forward();
    await tour.backward();
    expect(document.querySelector(".vt-popover-title")?.textContent).toBe("Run 2");
  });

  it("sets the data-<namespace>-step attribute from the tour's namespace", async () => {
    const tour = make({ namespace: "acme" });
    await tour.start();
    expect(wrapper()?.getAttribute("data-acme-step")).toBe("0");
    expect(document.body.classList.contains("acme-active")).toBe(true);
  });
});

describe("lifecycle edge cases", () => {
  it("goTo() on a tour with no steps rejects and does not start a run", async () => {
    const tour = make({ steps: [] });
    await expect(tour.goTo()).rejects.toBeInstanceOf(TourNavigationError);
    expect(tour.isRunning()).toBe(false);
    expect(tours.current).toBeNull();
  });

  it("dropStep of the step an in-flight navigation is heading to shows the step that follows it", async () => {
    const tour = make();
    await tour.start();
    const pending = tour.forward();
    tour.dropStep("b");
    await pending;
    await tick(30);

    expect(tour.steps.map((s) => s.id)).toEqual(["a", "c"]);
    expect(tour.currentStep?.id).toBe("c");
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
    expect(stepAttr()).toBe("1");
  });

  it("goTo resolves its reference when it runs, not when it is called", async () => {
    const tour = make();
    await tour.start();
    const first = tour.forward();
    const second = tour.goTo("c");
    tour.appendStep({ id: "z" }, 0);
    await Promise.all([first, second]);

    expect(tour.currentStep?.id).toBe("c");
  });

  it("a deactivated handler can restart the tour, a finished handler cannot", async () => {
    const tour = make();
    const log = record(tour);
    let restarted: Promise<void> | null = null;
    tour.once("finished", () => {
      void tour.start();
    });
    await tour.start();
    tour.finish();
    expect(tour.isRunning()).toBe(false);

    tour.once("deactivated", () => {
      restarted = tour.start();
    });
    await tour.start();
    tour.finish();
    await restarted;
    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep?.id).toBe("a");
    expect(log.filter((e) => e === "tour:started")).toHaveLength(3);
  });

  it("the Done button never opens the exit prompt", async () => {
    const exitPrompt = vi.fn(() => false);
    const tour = make({ exitPrompt }, ["a", "b"]);
    await tour.start();
    await tour.forward();
    click(".vt-popover-next-btn");

    expect(exitPrompt).not.toHaveBeenCalled();
    expect(tour.isRunning()).toBe(false);
  });

  it("hideCurrent() settles a navigation that is still in flight", async () => {
    const tour = make();
    await tour.start();
    const pending = tour.forward();
    tour.hideCurrent();
    await pending;
    expect(tour.isRunning()).toBe(true);
    await tour.goTo("c");
    expect(tour.currentStep?.id).toBe("c");
  });

  it("a prompt answered after its run ended does not end the next run", async () => {
    let answer!: (value: boolean) => void;
    const tour = make({
      exitPrompt: () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    });
    await tour.start();
    const pending = tour.exit();
    tour.finish();
    await tour.start();
    answer(true);
    await pending;

    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep?.id).toBe("a");
  });
});

describe("lifecycle failure paths", () => {
  it("a navigation whose step cannot be compiled rejects and ends the run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tour = createTour({
      animate: false,
      steps: [
        { id: "a", title: "A" },
        {
          id: "b",
          title: () => {
            throw new Error("title failed");
          },
        },
      ],
    });
    created.push(tour);
    await tour.start();

    await expect(tour.forward()).rejects.toThrow("title failed");

    expect(tour.isRunning()).toBe(false);
    expect(tours.current).toBeNull();
  });

  it("a goTo whose step was dropped while queued rejects without ending the run", async () => {
    const tour = make();
    await tour.start();
    const first = tour.forward();
    const stale = tour.goTo("c");
    const outcome = stale.then(
      () => "resolved",
      (error: unknown) => error
    );
    tour.dropStep("c");
    await first;

    expect(await outcome).toBeInstanceOf(TourNavigationError);
    expect(tour.isRunning()).toBe(true);
  });

  it("dropStep of the hidden current step does not show another popover", async () => {
    const tour = make();
    await tour.start();
    tour.hideCurrent();
    tour.dropStep("a");
    await tick(30);

    expect(wrapper()).toBeNull();
    expect(tour.isRunning()).toBe(true);
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("a presenter whose unmount throws still ends the run", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tour = make({
      presenter: () => ({
        mount: () => undefined,
        afterShow: () => undefined,
        afterReposition: () => undefined,
        update: () => undefined,
        beforeLeave: () => undefined,
        unmount: () => {
          throw new Error("unmount failed");
        },
      }),
    });
    await tour.start();
    tour.finish();

    expect(tour.isRunning()).toBe(false);
    expect(tours.current).toBeNull();
  });

  it("appendStep keeps the engine entry of the step on screen", async () => {
    let n = 0;
    const tour = createTour({ animate: false, steps: [{ id: "a", title: () => `Run ${++n}` }, { id: "b" }] });
    created.push(tour);
    await tour.start();
    tour.appendStep({ id: "c" });

    const entry = engineOf(tour)?.getConfig().steps?.[0];
    expect(entry?.popover?.title).toBe("Run 1");
  });

  it("hooks of an engine the tour no longer owns change nothing", async () => {
    const tour = make();
    await tour.start();
    const stale = engineOf(tour);
    tour.hideCurrent();
    await tour.goTo("b");
    const config = stale?.getConfig();
    const step = tour.currentStep;
    const driveStep = engineOf(tour)?.getConfig().steps?.[1];
    const opts = { reason: "done" } as never;
    config?.onNextClick?.(undefined, driveStep as never, opts);
    config?.onPrevClick?.(undefined, driveStep as never, opts);
    config?.onDestroyStarted?.(undefined, driveStep as never, opts);
    config?.onDestroyed?.(undefined, driveStep as never, opts);
    await tick(30);

    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep).toBe(step);
    expect(tour.currentStep?.id).toBe("b");
  });

  it("ending a run leaves the registry alone when another tour has become current", async () => {
    const tour = make();
    const other = make({}, ["x"]);
    await tour.start();
    setCurrentTour(other);
    tour.finish();

    expect(tours.current).toBe(other);
    setCurrentTour(null);
    await tour.start();
    expect(tours.current).toBe(tour);
    tour.finish();
    expect(tours.current).toBeNull();
  });
});
