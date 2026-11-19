import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { Tour, TourConfig, TourStep } from "../src/index";
import { setCurrentTour } from "../src/registry";
import { engineOf } from "../src/tour";
import type { Presenter, StepConfig } from "../src/types";
import { DialogPresenter } from "../src/presenter";
import { nextFrame, pressKey, tick } from "./engine/utils";
import { findExecutable, FLAG, PAYLOADS, pwned, stripSanitizer } from "./payloads";

const created: Tour[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  document.documentElement.style.removeProperty("--vt-nudge-duration");
  delete (window as unknown as Record<string, unknown>)[FLAG];
  vi.restoreAllMocks();
});

const PAGE = `<button id="t" type="button">Target</button><button id="u" type="button">Other</button>`;

function make(config: TourConfig): Tour {
  document.body.innerHTML = PAGE;
  document.documentElement.style.setProperty("--vt-nudge-duration", "10ms");
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  return tour;
}

async function show(config: TourConfig): Promise<Tour> {
  const tour = make(config);
  await tour.start();
  return tour;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover")!;
const nextButton = () => document.querySelector<HTMLButtonElement>(".vt-popover-next-btn")!;
const prevButton = () => document.querySelector<HTMLButtonElement>(".vt-popover-prev-btn")!;
const instructionText = () => wrapper().querySelector(".vt-popover-instruction-text")?.textContent;
const feedbackText = () => wrapper().querySelector(".vt-popover-feedback")?.textContent;
const nudged = () => wrapper().classList.contains("vt-popover-nudge");
const currentId = (tour: Tour) => tour.currentStep?.id;

const act = (id: string, extra: StepConfig = {}): StepConfig => ({ id, title: id, instruction: `Do ${id}`, ...extra });
const plain = (id: string, extra: StepConfig = {}): StepConfig => ({ id, title: id, ...extra });

describe("instruction row and gate", () => {
  it("renders the instruction inside the popover and disables Next while unmet", async () => {
    await show({ steps: [act("a"), plain("b")] });
    expect(instructionText()).toBe("Do a");
    expect(wrapper().querySelector(".vt-popover-instruction")!.parentElement).toBe(wrapper());
    expect(nextButton().getAttribute("aria-disabled")).toBe("true");
  });

  it("pressing Next on an unmet step nudges and does not move", async () => {
    const tour = await show({ steps: [act("a"), plain("b")] });
    nextButton().click();
    await tick(20);
    expect(currentId(tour)).toBe("a");
    expect(nudged()).toBe(true);
  });

  it("forward() on an unmet step nudges and does not move", async () => {
    const tour = await show({ steps: [act("a"), plain("b")] });
    await tour.forward();
    expect(currentId(tour)).toBe("a");
    expect(nudged()).toBe(true);
  });

  it("forward() moves on a step without an instruction", async () => {
    const tour = await show({ steps: [plain("a"), plain("b")] });
    await tour.forward();
    expect(currentId(tour)).toBe("b");
  });

  it("an instruction function is evaluated each time the step shows", async () => {
    let calls = 0;
    const tour = await show({ steps: [act("a", { instruction: () => `Round ${++calls}` }), plain("b")] });
    expect(instructionText()).toBe("Round 1");
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    await tour.backward();
    expect(currentId(tour)).toBe("a");
    expect(instructionText()).toBe("Round 2");
    expect(calls).toBe(2);
  });

  it("an empty instruction does not gate the step", async () => {
    const tour = await show({ steps: [act("a", { instruction: () => "" }), plain("b")] });
    await tour.forward();
    expect(currentId(tour)).toBe("b");
  });

  it("a sanitizer that empties the instruction hides the row but keeps the gate", async () => {
    const tour = await show({ sanitize: () => "", steps: [act("a", { instruction: "<b>x</b>" }), plain("b")] });
    expect(wrapper().querySelector<HTMLElement>(".vt-popover-instruction")!.style.display).toBe("none");
    await tour.forward();
    expect(currentId(tour)).toBe("a");
  });
});

describe("advance() and completion events", () => {
  it("emits completed, then step-completed, then moves on after advanceDelay through the navigator", async () => {
    const hidden = vi.fn(() => false);
    const log: string[] = [];
    const presenter = (tour: Tour): Presenter => {
      const dialog = new DialogPresenter(tour, "vt");
      return Object.assign(dialog, { onCompleted: (step: TourStep) => log.push(`presenter:${step.id}`) });
    };
    const tour = make({
      presenter,
      steps: [act("a", { advanceDelay: 600 }), plain("skipped", { shouldShow: hidden }), plain("c")],
    });
    tour.steps[0]!.on("completed", ({ step }) => log.push(`completed:${step.id}`));
    tour.on("step-completed", ({ step }) => log.push(`step-completed:${step.id}`));
    await tour.start();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    tour.advance();
    expect(log).toEqual(["presenter:a", "completed:a", "step-completed:a"]);
    expect(currentId(tour)).toBe("a");
    expect(wrapper().classList.contains("vt-popover-instruction-done")).toBe(true);

    await vi.advanceTimersByTimeAsync(599);
    expect(currentId(tour)).toBe("a");
    await vi.advanceTimersByTimeAsync(5);
    vi.useRealTimers();
    await vi.waitFor(() => expect(currentId(tour)).toBe("c"));
    expect(hidden).toHaveBeenCalled();
  });

  it("with no advanceDelay the step moves on at once", async () => {
    const tour = await show({ steps: [act("a"), plain("b")] });
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
  });

  it("completes only once however often advance() runs", async () => {
    const tour = make({ steps: [act("a", { advanceDelay: 50 }), plain("b")] });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    tour.advance();
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("a second advance() or click while the next step prepares slowly completes nothing again and skips nothing", async () => {
    const slow = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 120));
    const tour = make({
      steps: [act("a", { target: "#t", autoAdvance: { event: "click" } }), plain("b", { prepare: slow }), plain("c")],
    });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    tour.advance();
    tour.advance();
    await tick(10);
    document.querySelector<HTMLElement>("#t")!.click();
    await tick(10);
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    await tick(150);
    expect(currentId(tour)).toBe("b");
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("a double click on the target while the next step prepares slowly completes once", async () => {
    const slow = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 120));
    const tour = make({
      steps: [act("a", { target: "#t", autoAdvance: { event: "click" } }), plain("b", { prepare: slow }), plain("c")],
    });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    const target = document.querySelector<HTMLElement>("#t")!;
    target.click();
    await tick(10);
    target.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    await tick(150);
    expect(currentId(tour)).toBe("b");
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("advance() on a plain step only moves forward and emits no events", async () => {
    const tour = await show({ steps: [plain("a"), plain("b")] });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    expect(completed).not.toHaveBeenCalled();
  });

  it("advance() does nothing while no step is on screen", () => {
    const tour = make({ steps: [act("a"), plain("b")] });
    expect(() => tour.advance()).not.toThrow();
    expect(tour.isRunning()).toBe(false);
  });

  it("a plain step's completion emits no completed event", async () => {
    const tour = make({ steps: [plain("a", { target: "#t", autoAdvance: { event: "click" } }), plain("b")] });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    document.querySelector<HTMLElement>("#t")!.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    expect(completed).not.toHaveBeenCalled();
  });

  it("the registry relays step-completed", async () => {
    const seen = vi.fn();
    tours.on("step-completed", seen);
    const tour = await show({ steps: [act("a"), plain("b")] });
    tour.advance();
    expect(seen).toHaveBeenCalledWith({ tour, step: tour.steps[0] });
  });

  it("a throwing completed handler does not stop the move", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = make({ steps: [act("a"), plain("b")] });
    tour.steps[0]!.on("completed", () => {
      throw new Error("boom");
    });
    await tour.start();
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
  });
});

describe("autoAdvance on an action step", () => {
  it("strict click completes on a click and ignores pointerdown", async () => {
    const tour = make({
      steps: [act("a", { target: "#t", autoAdvance: { event: "click", strict: true } }), plain("b")],
    });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    const target = document.querySelector<HTMLElement>("#t")!;
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true, button: 0 }));
    await tick(20);
    expect(completed).not.toHaveBeenCalled();
    expect(currentId(tour)).toBe("a");
    target.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("a selector autoAdvance completes the action step instead of bypassing it", async () => {
    const tour = make({
      steps: [act("a", { advanceDelay: 400, autoAdvance: { event: "click", selector: "#u" } }), plain("b")],
    });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    document.querySelector<HTMLElement>("#u")!.click();
    await vi.waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    expect(currentId(tour)).toBe("a");
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
  });
});

describe("completion bookkeeping across navigation and runs", () => {
  const selectorStep = (id: string): StepConfig => act(id, { autoAdvance: { event: "click", selector: "#u" } });

  it("completes again after going back to the step", async () => {
    const tour = make({ steps: [selectorStep("a"), plain("b")] });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    document.querySelector<HTMLElement>("#u")!.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    await tour.backward();
    expect(currentId(tour)).toBe("a");
    document.querySelector<HTMLElement>("#u")!.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    expect(completed).toHaveBeenCalledTimes(2);
  });

  it("completes again in a restarted run", async () => {
    const tour = make({ steps: [selectorStep("a"), plain("b", { prepare: () => new Promise<void>((r) => setTimeout(r, 80)) })] });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    document.querySelector<HTMLElement>("#u")!.click();
    await tick(10);
    tour.finish();
    await tour.start();
    document.querySelector<HTMLElement>("#u")!.click();
    await vi.waitFor(() => expect(completed).toHaveBeenCalledTimes(2));
  });

  it("a duplicate completion that never reaches next() does not swallow the next real Next", async () => {
    const tour = make({
      steps: [act("a", { advanceDelay: 100 }), plain("b", { prepare: () => new Promise<void>((r) => setTimeout(r, 150)) }), plain("c")],
    });
    await tour.start();
    tour.advance();
    await tick(130);
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    await tick(150);
    nextButton().click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("c"));
  });

  it("a selector advance that the engine cannot complete does not fall back to a plain forward", async () => {
    const tour = make({ steps: [selectorStep("a"), plain("b")] });
    const completed = vi.fn();
    tour.on("step-completed", completed);
    await tour.start();
    const advance = vi.spyOn(engineOf(tour)!, "advance").mockReturnValue(false);
    document.querySelector<HTMLElement>("#u")!.click();
    await tick(30);
    expect(advance).toHaveBeenCalled();
    expect(currentId(tour)).toBe("a");
    expect(completed).not.toHaveBeenCalled();
  });
});

describe("nudge(message?)", () => {
  it("shows the feedback text, shakes and calls the presenter's onNudge", async () => {
    const onNudge = vi.fn();
    const tour = await show({
      presenter: (t) => Object.assign(new DialogPresenter(t, "vt"), { onNudge }),
      steps: [act("a"), plain("b")],
    });
    tour.nudge("Not that one");
    expect(feedbackText()).toBe("Not that one");
    expect(nudged()).toBe(true);
    expect(onNudge).toHaveBeenCalledTimes(1);
    expect(onNudge).toHaveBeenCalledWith(tour.steps[0]);
  });

  it("without a message it clears the feedback row", async () => {
    const tour = await show({ steps: [act("a")] });
    tour.nudge("first");
    tour.nudge();
    expect(feedbackText()).toBe("");
  });

  it("the engine's own nudge (Next on an unmet step) reaches onNudge", async () => {
    const onNudge = vi.fn();
    const tour = await show({
      presenter: (t) => Object.assign(new DialogPresenter(t, "vt"), { onNudge }),
      steps: [act("a"), plain("b")],
    });
    nextButton().click();
    await tour.forward();
    expect(onNudge).toHaveBeenCalledTimes(2);
  });

  it("does nothing while no step is on screen", () => {
    const tour = make({ steps: [act("a")] });
    expect(() => tour.nudge("x")).not.toThrow();
  });

  it("a throwing presenter hook is reported and does not break the nudge", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = await show({
      presenter: (t) =>
        Object.assign(new DialogPresenter(t, "vt"), {
          onNudge: () => {
            throw new Error("boom");
          },
        }),
      steps: [act("a")],
    });
    tour.nudge("x");
    expect(error).toHaveBeenCalled();
    expect(nudged()).toBe(true);
  });
});

describe.each(Object.entries(PAYLOADS))("%s payload through the new sinks", (_name, payload) => {
  const markup = `ok ${payload} end`;

  it("nudge(message), instruction string and instruction function", async () => {
    const sanitize = vi.fn(stripSanitizer);
    const tour = await show({
      sanitize,
      steps: [act("a", { instruction: markup }), act("b", { instruction: () => markup })],
    });
    tour.nudge(markup);
    expect(feedbackText()).toContain("ok");
    expect(findExecutable(wrapper())).toEqual([]);
    tour.advance();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    expect(instructionText()).toContain("ok");
    expect(findExecutable(wrapper())).toEqual([]);
    tour.nudge(markup);
    expect(findExecutable(wrapper())).toEqual([]);
    expect(sanitize).toHaveBeenCalled();
    expect(pwned()).toBeUndefined();
  });

  it("progress text from the counter after a step is added", async () => {
    const tour = await show({ sanitize: stripSanitizer, counter: () => markup, steps: [act("a")] });
    tour.appendStep(plain("b"));
    await nextFrame();
    expect(findExecutable(wrapper())).toEqual([]);
    expect(pwned()).toBeUndefined();
  });
});

describe("custom forward buttons and the gate", () => {
  const forward: StepConfig["buttons"] = [{ text: "Go on", action: "forward" }];

  it("a forward button on an unmet step nudges and does not move", async () => {
    const tour = await show({ steps: [act("a", { buttons: forward }), plain("b")] });
    document.querySelector<HTMLButtonElement>(".vt-footer > .vt-button")!.click();
    await tick(20);
    expect(currentId(tour)).toBe("a");
    expect(nudged()).toBe(true);
  });

  it("the same button moves on during advanceDelay once the instruction is met", async () => {
    const tour = await show({ steps: [act("a", { buttons: forward, advanceDelay: 5000 }), plain("b")] });
    tour.advance();
    expect(currentId(tour)).toBe("a");
    document.querySelector<HTMLButtonElement>(".vt-footer > .vt-button")!.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
  });

  it("a forward button on a step without an instruction moves", async () => {
    const tour = await show({ steps: [plain("a", { buttons: forward }), plain("b")] });
    document.querySelector<HTMLButtonElement>(".vt-footer > .vt-button")!.click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
  });
});

describe("arrow keys with custom buttons", () => {
  const buttons: StepConfig["buttons"] = [{ text: "Go on", action: "forward" }];

  it("ArrowRight and ArrowLeft navigate although the engine's Next and Back are hidden", async () => {
    const tour = await show({ steps: [plain("a", { buttons }), plain("b", { buttons }), plain("c", { buttons })] });
    expect(nextButton().style.display).toBe("none");
    pressKey("ArrowRight");
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
    pressKey("ArrowLeft");
    await vi.waitFor(() => expect(currentId(tour)).toBe("a"));
  });

  it("ArrowLeft on the first step stays put", async () => {
    const tour = await show({ steps: [plain("a", { buttons }), plain("b")] });
    pressKey("ArrowLeft");
    await tick(20);
    expect(currentId(tour)).toBe("a");
  });

  it("ArrowRight on an unmet action step nudges", async () => {
    const tour = await show({ steps: [act("a", { buttons }), plain("b")] });
    pressKey("ArrowRight");
    await tick(20);
    expect(currentId(tour)).toBe("a");
    expect(nudged()).toBe(true);
  });

  it("ArrowRight goes through eligibility: a skipped step is passed over", async () => {
    const tour = await show({
      steps: [plain("a", { buttons }), plain("b", { shouldShow: () => false }), plain("c")],
    });
    pressKey("ArrowRight");
    await vi.waitFor(() => expect(currentId(tour)).toBe("c"));
  });

  it("a step whose buttons only exit or finish keeps the arrows still", async () => {
    const tour = await show({ steps: [plain("a", { buttons: [{ text: "Quit", action: "exit" }] }), plain("b")] });
    pressKey("ArrowRight");
    await tick(30);
    expect(currentId(tour)).toBe("a");
  });

  it("keys.arrows: false turns the arrows off", async () => {
    const tour = await show({ keys: { arrows: false }, steps: [plain("a", { buttons }), plain("b")] });
    pressKey("ArrowRight");
    await tick(30);
    expect(currentId(tour)).toBe("a");
  });

  it("without custom buttons, hiding Next with a step default keeps the engine rule", async () => {
    const tour = await show({ steps: [plain("a"), plain("b")] });
    pressKey("ArrowRight");
    await vi.waitFor(() => expect(currentId(tour)).toBe("b"));
  });
});

describe("engine state after appendStep and dropStep", () => {
  const engineIndex = (tour: Tour) => engineOf(tour)!.getActiveIndex();

  it("appending before the current step moves the engine's activeIndex with it", async () => {
    const tour = await show({ steps: [plain("a"), plain("b")] });
    await tour.forward();
    expect(engineIndex(tour)).toBe(1);
    tour.appendStep(plain("x"), 0);
    expect(tour.steps.indexOf(tour.currentStep!)).toBe(2);
    expect(engineIndex(tour)).toBe(2);
    expect(wrapper().getAttribute("data-vt-step")).toBe("2");
    await tour.backward();
    expect(currentId(tour)).toBe("a");
    await tour.backward();
    expect(currentId(tour)).toBe("x");
  });

  it("dropping an earlier step moves the engine's activeIndex back", async () => {
    const tour = await show({ steps: [plain("a"), plain("b"), plain("c")] });
    await tour.forward();
    tour.dropStep("a");
    expect(engineIndex(tour)).toBe(0);
    expect(tour.steps.indexOf(tour.currentStep!)).toBe(0);
    expect(wrapper().getAttribute("data-vt-step")).toBe("0");
    expect(prevButton().disabled).toBe(true);
    await tour.forward();
    expect(currentId(tour)).toBe("c");
  });

  it("forward after an insert before the current step reaches the step after it", async () => {
    const tour = await show({ steps: [plain("a"), plain("b"), plain("c")] });
    await tour.forward();
    tour.appendStep(plain("x"), 0);
    nextButton().click();
    await vi.waitFor(() => expect(currentId(tour)).toBe("c"));
  });

  it("inserting before the first step enables Back", async () => {
    const tour = await show({ steps: [plain("a"), plain("b")] });
    expect(prevButton().disabled).toBe(true);
    tour.appendStep(plain("x"), 0);
    expect(prevButton().disabled).toBe(false);
  });

  it("the last step reads Done, turns to Next after an append and back to Done after a drop", async () => {
    const tour = await show({ steps: [plain("a"), plain("b")] });
    await tour.forward();
    expect(nextButton().textContent).toBe("Done");
    expect(nextButton().classList.contains("vt-popover-done-btn")).toBe(true);
    tour.appendStep(plain("c"));
    expect(nextButton().textContent).toBe("Next");
    expect(nextButton().classList.contains("vt-popover-done-btn")).toBe(false);
    tour.dropStep("c");
    expect(nextButton().textContent).toBe("Done");
    expect(nextButton().classList.contains("vt-popover-done-btn")).toBe(true);
  });

  it("a custom Done label survives the round trip", async () => {
    const tour = await show({ labels: { done: "Finish", next: "Onward" }, steps: [plain("a")] });
    expect(nextButton().textContent).toBe("Finish");
    tour.appendStep(plain("b"));
    expect(nextButton().textContent).toBe("Onward");
    tour.dropStep("b");
    expect(nextButton().textContent).toBe("Finish");
  });

  it("an appended action step keeps its gate and the progress counter follows", async () => {
    const tour = await show({ steps: [plain("a")] });
    tour.appendStep(act("b"));
    expect(wrapper().querySelector(".vt-popover-progress-text")?.textContent).toBe("1 of 2");
    await tour.forward();
    expect(instructionText()).toBe("Do b");
    await tour.forward();
    expect(currentId(tour)).toBe("b");
  });
});
