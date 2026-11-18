import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { Tour } from "../src/index";
import { setCurrentTour } from "../src/registry";
import type { StepConfig, TourConfig } from "../src/types";
import { tick } from "./engine/utils";

const created: Tour[] = [];

beforeEach(() => {
  document.body.innerHTML = '<div id="a"></div><div id="b"></div><div id="c"></div>';
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

function record(tour: Tour): string[] {
  const log: string[] = [];
  for (const e of ["started", "activated", "deactivated", "finished"] as const) tour.on(e, () => log.push(`tour:${e}`));
  tour.on("exited", (p) => log.push(`tour:exited ${p.reason}`));
  tour.on("step-shown", (p) => log.push(`shown ${p.step.id}`));
  return log;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover");
const stepAttr = () => wrapper()?.getAttribute("data-vt-step");
const insertLater = (id: string, ms: number) => setTimeout(() => {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
}, ms);

describe("shouldShow (A-5)", () => {
  it("skips a step whose shouldShow is false, forward and backward", async () => {
    const tour = make([{ id: "a" }, { id: "b", shouldShow: () => false }, { id: "c" }]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("c");
    await tour.backward();
    expect(tour.currentStep?.id).toBe("a");
  });

  it("evaluates shouldShow each time the step is considered", async () => {
    let allowed = false;
    const tour = make([{ id: "a" }, { id: "b", shouldShow: () => allowed }, { id: "c" }]);
    await tour.start();
    await tour.forward();
    await tour.backward();
    allowed = true;
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("counts a throwing shouldShow as false and reports it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make([
      { id: "a" },
      {
        id: "b",
        shouldShow: () => {
          throw new Error("boom");
        },
      },
      { id: "c" },
    ]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("c");
    expect(error).toHaveBeenCalled();
  });

  it("skips an ineligible first step at start", async () => {
    const tour = make([{ id: "a", shouldShow: () => false }, { id: "b" }]);
    await tour.start();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("goTo shows the requested step even when its shouldShow is false", async () => {
    const tour = make([{ id: "a" }, { id: "b", shouldShow: () => false }, { id: "c" }]);
    await tour.start();
    await tour.goTo("b");
    expect(tour.currentStep?.id).toBe("b");
  });
});

describe("whenMissing (A-6)", () => {
  it("a missing target with the default centers the step", async () => {
    const tour = make([{ id: "a" }, { id: "b", target: "#nope" }]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(tour.currentStep?.resolvedTarget).toBeNull();
    expect(wrapper()).not.toBeNull();
  });

  it("forward over two skip steps with missing targets lands on the third", async () => {
    const tour = make([
      { id: "a" },
      { id: "b", target: "#nope", whenMissing: "skip" },
      { id: "c", target: "#nope-too", whenMissing: "skip" },
      { id: "d", target: "#c" },
    ]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("d");
    expect(tour.currentStep?.resolvedTarget).toBe(document.querySelector("#c"));
  });

  it("backward over skip steps lands on the nearest eligible one", async () => {
    const tour = make([
      { id: "a" },
      { id: "b", target: "#nope", whenMissing: "skip" },
      { id: "c", target: "#nope", whenMissing: "skip" },
      { id: "d" },
    ]);
    await tour.start();
    await tour.goTo("d");
    await tour.backward();
    expect(tour.currentStep?.id).toBe("a");
  });

  it("a skip step is shown when its target exists", async () => {
    const tour = make([{ id: "a" }, { id: "b", target: "#b", whenMissing: "skip" }]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(tour.currentStep?.resolvedTarget).toBe(document.querySelector("#b"));
  });

  it("a step without a target is never skipped", async () => {
    const tour = make([{ id: "a" }, { id: "b", whenMissing: "skip" }]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("the Done button appears on the step before a trailing skip step with a missing target", async () => {
    const tour = make([{ id: "a" }, { id: "b" }, { id: "c", target: "#nope", whenMissing: "skip" }]);
    await tour.start();
    await tour.forward();
    expect(document.querySelector(".vt-popover-next-btn")?.textContent).toBe("Done");
  });

  it("the Next button stays when a trailing skip step has a target that exists", async () => {
    const tour = make([{ id: "a" }, { id: "b" }, { id: "c", target: "#c", whenMissing: "skip" }]);
    await tour.start();
    await tour.forward();
    expect(document.querySelector(".vt-popover-next-btn")?.textContent).not.toBe("Done");
  });

  it("all remaining steps skipped moving forward finishes the tour", async () => {
    const tour = make([
      { id: "a" },
      { id: "b", target: "#nope", whenMissing: "skip" },
      { id: "c", shouldShow: () => false },
    ]);
    await tour.start();
    const log = record(tour);
    await tour.forward();
    expect(log).toEqual(["tour:finished", "tour:deactivated"]);
    expect(tour.isRunning()).toBe(false);
    expect(wrapper()).toBeNull();
  });

  it("all previous steps skipped moving backward exits without the prompt", async () => {
    const exitPrompt = vi.fn(() => false);
    let showEarly = false;
    const tour = make(
      [
        { id: "a", shouldShow: () => showEarly },
        { id: "b", target: "#nope", whenMissing: "skip", shouldShow: () => showEarly },
        { id: "c" },
      ],
      { exitPrompt }
    );
    showEarly = true;
    await tour.goTo("c");
    showEarly = false;
    const log = record(tour);
    await tour.backward();
    expect(exitPrompt).not.toHaveBeenCalled();
    expect(log).toEqual(["tour:exited api", "tour:deactivated"]);
    expect(tour.isRunning()).toBe(false);
  });
});

describe("waitFor (A-4)", () => {
  it("start() resolves only after a late target attaches", async () => {
    const tour = make([{ id: "a", target: "#late", waitFor: 3000 }]);
    insertLater("late", 60);
    const began = performance.now();
    await tour.start();
    expect(performance.now() - began).toBeGreaterThanOrEqual(50);
    expect(tour.currentStep?.resolvedTarget).toBe(document.querySelector("#late"));
  });

  it("falls back to centered after the wait when the target never appears", async () => {
    const tour = make([{ id: "a", target: "#never", waitFor: 80 }]);
    const began = performance.now();
    await tour.start();
    expect(performance.now() - began).toBeGreaterThanOrEqual(70);
    expect(tour.currentStep?.id).toBe("a");
    expect(tour.currentStep?.resolvedTarget).toBeNull();
  });

  it("skips after the wait with whenMissing skip", async () => {
    const tour = make([{ id: "a", target: "#never", waitFor: 60, whenMissing: "skip" }, { id: "b" }]);
    await tour.start();
    expect(tour.currentStep?.id).toBe("b");
  });

  it("marks the visible popover while waiting and clears the mark afterwards", async () => {
    const tour = make([{ id: "a" }, { id: "b", target: "#late", waitFor: 3000 }]);
    await tour.start();
    insertLater("late", 80);
    const moving = tour.forward();
    await tick(20);
    expect(wrapper()?.classList.contains("vt-waiting")).toBe(true);
    expect(wrapper()?.getAttribute("aria-busy")).toBe("true");
    expect(stepAttr()).toBe("0");
    expect(tour.currentStep?.id).toBe("a");
    await moving;
    expect(tour.currentStep?.id).toBe("b");
    expect(wrapper()?.classList.contains("vt-waiting")).toBe(false);
    expect(wrapper()?.hasAttribute("aria-busy")).toBe(false);
  });

  it("exit() during a wait ends the tour and the waited step never shows", async () => {
    const tour = make([{ id: "a" }, { id: "b", target: "#never", waitFor: 5000 }]);
    await tour.start();
    const log = record(tour);
    const moving = tour.forward();
    await tick(10);
    await tour.exit();
    await moving;
    expect(log).toEqual(["tour:exited api", "tour:deactivated"]);
    expect(tour.isRunning()).toBe(false);
  });
});

describe("prepare and revealWith (A-7, A-9, SC-2)", () => {
  it("looks up the target, then prepares, then shows", async () => {
    const order: string[] = [];
    const tour = make([
      { id: "a" },
      {
        id: "b",
        target: () => {
          order.push("lookup");
          return "#b";
        },
        prepare: () => {
          order.push("prepare");
        },
      },
    ]);
    await tour.start();
    tour.steps[1]?.on("will-show", () => order.push("will-show"));
    await tour.forward();
    expect(order.slice(0, 3)).toEqual(["lookup", "prepare", "will-show"]);
    expect(order.filter((e) => e === "lookup")).toHaveLength(1);
  });

  it("a prepare that creates the target cannot rescue a skip step", async () => {
    const prepare = vi.fn(() => {
      const el = document.createElement("div");
      el.id = "made";
      document.body.appendChild(el);
    });
    const tour = make([
      { id: "a" },
      { id: "b", target: "#made", whenMissing: "skip", prepare },
      { id: "c" },
    ]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("c");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("a prepare that creates the target of a centered step still shows it centered", async () => {
    const tour = make([
      { id: "a" },
      {
        id: "b",
        target: "#made",
        prepare: () => {
          const el = document.createElement("div");
          el.id = "made";
          document.body.appendChild(el);
        },
      },
    ]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(tour.currentStep?.resolvedTarget).toBeNull();
  });

  it("awaits an async prepare before the step shows", async () => {
    const order: string[] = [];
    const tour = make([
      { id: "a" },
      {
        id: "b",
        prepare: async () => {
          await tick(30);
          order.push("prepared");
        },
      },
    ]);
    await tour.start();
    tour.steps[1]?.on("will-show", () => order.push("will-show"));
    await tour.forward();
    expect(order).toEqual(["prepared", "will-show"]);
  });

  it("reports a throwing prepare and still shows the step", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make([
      { id: "a" },
      {
        id: "b",
        prepare: () => {
          throw new Error("boom");
        },
      },
    ]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(error).toHaveBeenCalled();
  });

  it("reports a rejecting async prepare and still shows the step", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make([{ id: "a" }, { id: "b", prepare: () => Promise.reject(new Error("boom")) }]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(error).toHaveBeenCalled();
  });

  it("forward() during a pending prepare queues behind it", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const tour = make([{ id: "a" }, { id: "b", prepare: () => gate }, { id: "c" }]);
    await tour.start();
    const first = tour.forward();
    await tick(10);
    const second = tour.forward();
    await tick(10);
    expect(tour.currentStep?.id).toBe("a");
    release();
    await Promise.all([first, second]);
    expect(tour.currentStep?.id).toBe("c");
  });

  it("two forward calls queued behind a prepare produce one move", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const tour = make([{ id: "a" }, { id: "b", prepare: () => gate }, { id: "c" }, { id: "d" }]);
    await tour.start();
    const log = record(tour);
    const first = tour.forward();
    await tick(10);
    const second = tour.forward();
    const third = tour.forward();
    release();
    await Promise.all([first, second, third]);
    expect(log).toEqual(["shown b", "shown c"]);
  });

  it("exit() during prepare ends the tour and the prepared step never shows", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const tour = make([{ id: "a" }, { id: "b", prepare: () => gate }]);
    await tour.start();
    const log = record(tour);
    const moving = tour.forward();
    await tick(10);
    await tour.exit();
    release();
    await moving;
    expect(log).toEqual(["tour:exited api", "tour:deactivated"]);
    expect(log).not.toContain("shown b");
  });

  it("exit() during a prepare that never settles still releases the queue", async () => {
    const stuck = make([{ id: "a" }, { id: "b", prepare: () => new Promise<void>(() => {}) }]);
    await stuck.start();
    const moving = stuck.forward();
    await tick(10);
    await stuck.exit();
    await moving;
    await stuck.start();
    expect(stuck.currentStep?.id).toBe("a");
  });

  it("awaits revealWith with the resolved target before the step shows", async () => {
    const order: string[] = [];
    const reveal = vi.fn(async (el: Element) => {
      await tick(20);
      order.push(`reveal ${el.id}`);
    });
    const tour = make([{ id: "a" }, { id: "b", target: "#b", revealWith: reveal }]);
    await tour.start();
    tour.steps[1]?.on("will-show", () => order.push("will-show"));
    await tour.forward();
    expect(order).toEqual(["reveal b", "will-show"]);
  });

  it("does not call revealWith for a step that ends up centered", async () => {
    const reveal = vi.fn();
    const tour = make([{ id: "a" }, { id: "b", target: "#nope", revealWith: reveal }]);
    await tour.start();
    await tour.forward();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("does not scroll the target a second time when revealWith is set", async () => {
    const scroll = vi.fn();
    (document.querySelector("#b") as HTMLElement).scrollIntoView = scroll;
    const tour = make([{ id: "a" }, { id: "b", target: "#b", revealWith: () => {} }]);
    await tour.start();
    await tour.forward();
    expect(scroll).not.toHaveBeenCalled();
  });

  it("reports a throwing revealWith and still shows the step", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make([
      { id: "a" },
      {
        id: "b",
        target: "#b",
        revealWith: () => {
          throw new Error("boom");
        },
      },
    ]);
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(error).toHaveBeenCalled();
  });
});

describe("dropStep follow-up", () => {
  it("moves to the next eligible step, skipping a missing skip step", async () => {
    const tour = make([
      { id: "a" },
      { id: "b" },
      { id: "c", target: "#nope", whenMissing: "skip" },
      { id: "d" },
    ]);
    await tour.start();
    await tour.forward();
    tour.dropStep("b");
    await tick(30);
    expect(tour.currentStep?.id).toBe("d");
  });

  it("exits without a prompt when every remaining step is skipped", async () => {
    const exitPrompt = vi.fn(() => false);
    const tour = make([{ id: "a" }, { id: "b" }, { id: "c", target: "#nope", whenMissing: "skip" }], { exitPrompt });
    await tour.start();
    await tour.forward();
    const log = record(tour);
    tour.dropStep("b");
    await tick(30);
    expect(exitPrompt).not.toHaveBeenCalled();
    expect(log).toContain("tour:exited api");
    expect(tour.isRunning()).toBe(false);
  });
});
