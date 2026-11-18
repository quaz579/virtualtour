import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "./utils";
import * as position from "../../src/engine/popover/position";

useDriverHarness();

const cutoutWidth = () => {
  const path = document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!;
  return Number(/h(\d+(?:\.\d+)?) /.exec(path.split("M").at(-1)!)![1]);
};

const cutoutRadius = () => {
  const path = document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!;
  return Number(/a(\d+),\d+ /.exec(path)![1]);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("per-step stage and offset", () => {
  it("changes the cut-out by the padding delta between steps", async () => {
    const d = createDriver({
      animate: false,
      stagePadding: 10,
      stageRadius: 0,
      steps: [
        { ...SAMPLE_STEPS[0], stagePadding: 4 },
        { ...SAMPLE_STEPS[1], stagePadding: 20 },
        SAMPLE_STEPS[2],
      ],
    });
    d.drive();
    await nextFrame();
    const first = cutoutWidth();

    d.moveNext();
    await nextFrame();
    const second = cutoutWidth();

    expect(second - first).toBe((20 - 4) * 2);

    d.moveNext();
    await nextFrame();
    expect(cutoutWidth() - first).toBe((10 - 4) * 2);
  });

  it("uses a per-step stageRadius and falls back to the config value", async () => {
    const d = createDriver({
      animate: false,
      stagePadding: 20,
      stageRadius: 3,
      steps: [{ ...SAMPLE_STEPS[0], stageRadius: 12 }, SAMPLE_STEPS[1]],
    });
    d.drive();
    await nextFrame();
    expect(cutoutRadius()).toBe(12);

    d.moveNext();
    await nextFrame();
    expect(cutoutRadius()).toBe(3);
  });

  it("passes the per-step popoverOffset and stagePadding to repositionPopover", () => {
    const spy = vi.spyOn(position, "repositionPopover");
    const d = createDriver({
      animate: false,
      stagePadding: 10,
      popoverOffset: 10,
      steps: [{ ...SAMPLE_STEPS[0], popoverOffset: 30, stagePadding: 5 }, SAMPLE_STEPS[1]],
    });
    d.drive();

    expect(spy.mock.calls.at(-1)![2]).toMatchObject({ offset: 35, padding: 5 });

    d.moveNext();

    expect(spy.mock.calls.at(-1)![2]).toMatchObject({ offset: 20, padding: 10 });
  });
});
