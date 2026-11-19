import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DriveStep } from "../../../src/engine/driver";
import { createDriver, navButton, nextFrame, popoverEl, pressKey, SAMPLE_STEPS, tick, useDriverHarness } from "../utils";

useDriverHarness();

beforeEach(() => {
  document.documentElement.style.setProperty("--vt-nudge-duration", "10ms");
});

afterEach(async () => {
  await tick(200);
  document.documentElement.style.removeProperty("--vt-nudge-duration");
});

const actionStep = (extra: Partial<DriveStep> = {}): DriveStep => ({
  ...SAMPLE_STEPS[0],
  ...extra,
  popover: { title: "Act", instruction: "Do it." },
});

async function start(config: Parameters<typeof createDriver>[0]) {
  const d = createDriver({ animate: false, ...config });
  d.drive(0);
  await nextFrame();
  return d;
}

describe("Config.onStepCompleted", () => {
  it("runs once with the element and step after the step is marked done and before advanceDelay elapses", async () => {
    const onStepCompleted = vi.fn(() => {
      expect(popoverEl()?.classList.contains("vt-popover-instruction-done")).toBe(false);
    });
    const d = await start({ onStepCompleted, steps: [actionStep({ advanceDelay: 80 }), SAMPLE_STEPS[1]] });
    d.advance();

    expect(onStepCompleted).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onStepCompleted.mock.calls[0] as unknown as [Element, DriveStep, { driver: unknown }];
    expect(element).toBe(document.querySelector("#intro"));
    expect(step.popover?.instruction).toBe("Do it.");
    expect(opts.driver).toBe(d);
    expect(d.getActiveIndex()).toBe(0);
    await tick(150);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("runs for an advanceOn gesture too", async () => {
    const onStepCompleted = vi.fn();
    await start({ onStepCompleted, steps: [actionStep({ advanceOn: "click" }), SAMPLE_STEPS[1]] });
    document.querySelector<HTMLElement>("#intro")!.click();
    await tick(20);
    expect(onStepCompleted).toHaveBeenCalledTimes(1);
  });

  it("a hook that destroys the tour stops the move", async () => {
    const onNextClick = vi.fn();
    const d = await start({
      onNextClick,
      onStepCompleted: () => d.destroy(),
      steps: [actionStep(), SAMPLE_STEPS[1]],
    });
    d.advance();
    expect(d.isActive()).toBe(false);
    expect(onNextClick).not.toHaveBeenCalled();
  });
});

describe("completion is final", () => {
  it("completes again each time while the move that follows does not leave the step", async () => {
    const onStepCompleted = vi.fn();
    const onNextClick = vi.fn();
    const d = await start({ onStepCompleted, onNextClick, steps: [actionStep(), SAMPLE_STEPS[1]] });
    d.advance();
    d.advance();
    expect(onStepCompleted).toHaveBeenCalledTimes(2);
    expect(onNextClick).toHaveBeenCalledTimes(2);
    expect(d.nudgeIfGated()).toBe(true);
  });

  it("advance() reports whether a step could complete", async () => {
    const d = createDriver({ animate: false, steps: [actionStep(), SAMPLE_STEPS[1]] });
    expect(d.advance()).toBe(false);
    d.drive(0);
    await nextFrame();
    expect(d.advance()).toBe(true);
  });

  it("advance() reports false while the step waits for its element", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#late", waitForElement: 300, popover: { title: "Late", instruction: "Do it." } }],
    });
    d.drive(0);
    await nextFrame();
    expect(d.advance()).toBe(false);
  });
});

describe("Config.onNudge", () => {
  it("runs for api nudges with the nudged step", async () => {
    const onNudge = vi.fn();
    const d = await start({ onNudge, steps: [actionStep(), SAMPLE_STEPS[1]] });
    d.nudge();
    expect(onNudge).toHaveBeenCalledTimes(1);
    expect((onNudge.mock.calls[0] as unknown as [DriveStep])[0].popover?.instruction).toBe("Do it.");
  });

  it("runs when Next, ArrowRight or the Next button hit an unmet action step", async () => {
    const onNudge = vi.fn();
    await start({ onNudge, steps: [actionStep(), SAMPLE_STEPS[1]] });
    navButton("next")!.click();
    pressKey("ArrowRight");
    expect(onNudge).toHaveBeenCalledTimes(2);
  });

  it("does not run while the popover is hidden or gone", async () => {
    const onNudge = vi.fn();
    const d = await start({ onNudge, steps: [actionStep()] });
    d.destroy();
    d.nudge();
    expect(onNudge).not.toHaveBeenCalled();
  });
});

describe("Driver.nudgeIfGated", () => {
  it("nudges and returns true on an unmet action step", async () => {
    const onNudge = vi.fn();
    const d = await start({ onNudge, steps: [actionStep(), SAMPLE_STEPS[1]] });
    expect(d.nudgeIfGated()).toBe(true);
    expect(onNudge).toHaveBeenCalledTimes(1);
  });

  it("returns false and stays quiet on a plain step", async () => {
    const onNudge = vi.fn();
    const d = await start({ onNudge, steps: SAMPLE_STEPS });
    expect(d.nudgeIfGated()).toBe(false);
    expect(onNudge).not.toHaveBeenCalled();
  });

  it("returns false once the step is done", async () => {
    const d = await start({ steps: [actionStep({ advanceDelay: 500 }), SAMPLE_STEPS[1]] });
    d.advance();
    expect(d.nudgeIfGated()).toBe(false);
  });
});

describe("Popover.navigateWithKeys", () => {
  const hidden = (extra: DriveStep["popover"] = {}): DriveStep[] => [
    { ...SAMPLE_STEPS[0], popover: { title: "A", showButtons: [], ...extra } },
    { ...SAMPLE_STEPS[1], popover: { title: "B", showButtons: [], ...extra } },
  ];

  it("lets the arrow keys move while showButtons hides Next and Back", async () => {
    const d = await start({ steps: hidden({ navigateWithKeys: true }) });
    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(1);
    await nextFrame();
    pressKey("ArrowLeft");
    expect(d.getActiveIndex()).toBe(0);
  });

  it("is off by default: hidden buttons keep the arrows still", async () => {
    const d = await start({ steps: hidden() });
    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(0);
  });

  it("still honors disableButtons", async () => {
    const d = await start({ steps: hidden({ navigateWithKeys: true, disableButtons: ["next"] }) });
    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(0);
  });
});

describe("setConfig with changed steps", () => {
  it("re-indexes the active step when steps are inserted before it", async () => {
    const d = await start({ steps: SAMPLE_STEPS });
    d.moveNext();
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
    const extra: DriveStep = { element: "#intro", popover: { title: "New" } };
    const config = d.getConfig();
    d.setConfig({ ...config, steps: [extra, ...config.steps!] });
    expect(d.getActiveIndex()).toBe(2);
    expect(popoverEl()?.getAttribute("data-vt-step")).toBe("2");
    expect(navButton("prev")!.disabled).toBe(false);
  });

  it("re-indexes when steps before the active one are removed", async () => {
    const d = await start({ steps: SAMPLE_STEPS });
    d.moveTo(2);
    await nextFrame();
    const config = d.getConfig();
    d.setConfig({ ...config, steps: config.steps!.slice(1) });
    expect(d.getActiveIndex()).toBe(1);
    expect(navButton("next")!.textContent).toBe("Done");
  });

  it("refreshes the Done label and the progress text when the step list grows or shrinks", async () => {
    const d = await start({ showProgress: true, steps: SAMPLE_STEPS.slice(0, 2) });
    d.moveNext();
    await nextFrame();
    expect(navButton("next")!.textContent).toBe("Done");
    const config = d.getConfig();
    d.setConfig({ ...config, steps: [...config.steps!, SAMPLE_STEPS[2]] });
    expect(navButton("next")!.textContent).toBe("Next");
    expect(document.querySelector(".vt-popover-progress-text")?.textContent).toBe("2 of 3");
    d.setConfig({ ...d.getConfig(), steps: config.steps! });
    expect(navButton("next")!.textContent).toBe("Done");
    expect(document.querySelector(".vt-popover-progress-text")?.textContent).toBe("2 of 2");
  });

  it("survives the active step being removed: no throw, popover text untouched", async () => {
    const d = await start({ steps: SAMPLE_STEPS });
    d.moveNext();
    await nextFrame();
    const before = popoverEl()?.textContent;
    const config = d.getConfig();
    expect(() => d.setConfig({ ...config, steps: [config.steps![0]!, config.steps![2]!] })).not.toThrow();
    expect(popoverEl()?.textContent).toBe(before);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("leaves the active index alone when the active step is not in the new list", async () => {
    const d = await start({ steps: SAMPLE_STEPS });
    d.moveNext();
    await nextFrame();
    d.setConfig({ ...d.getConfig(), steps: SAMPLE_STEPS.map(step => ({ ...step })) });
    expect(d.getActiveIndex()).toBe(1);
  });
});
