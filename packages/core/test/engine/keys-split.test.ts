import { describe, expect, it } from "vitest";
import { createDriver, nextFrame, pressKey, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("split keyboard switches", () => {
  it("moves with the arrows and closes on Escape by default", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(1);
    await nextFrame();

    pressKey("ArrowLeft");
    expect(d.getActiveIndex()).toBe(0);

    pressKey("Escape");
    expect(d.isActive()).toBe(false);
  });

  it("ignores Escape but still moves with the arrows when allowEscape is false", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, allowEscape: false });
    d.drive();
    await nextFrame();

    pressKey("Escape");
    expect(d.isActive()).toBe(true);

    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(1);
    await nextFrame();

    pressKey("ArrowLeft");
    expect(d.getActiveIndex()).toBe(0);
  });

  it("ignores the arrows but still closes on Escape when allowArrowKeys is false", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, allowArrowKeys: false });
    d.drive(1);
    await nextFrame();

    pressKey("ArrowRight");
    pressKey("ArrowLeft");
    expect(d.getActiveIndex()).toBe(1);

    pressKey("Escape");
    expect(d.isActive()).toBe(false);
  });

  it("ignores Escape and both arrows when allowKeyboardControl is false", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, allowKeyboardControl: false });
    d.drive(1);
    await nextFrame();

    pressKey("ArrowRight");
    pressKey("ArrowLeft");
    pressKey("Escape");

    expect(d.getActiveIndex()).toBe(1);
    expect(d.isActive()).toBe(true);
  });

  it("lets allowKeyboardControl: false win over allowEscape and allowArrowKeys set to true", async () => {
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      allowKeyboardControl: false,
      allowEscape: true,
      allowArrowKeys: true,
    });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    pressKey("Escape");

    expect(d.getActiveIndex()).toBe(0);
    expect(d.isActive()).toBe(true);
  });

  it("ignores both when both switches are false", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, allowEscape: false, allowArrowKeys: false });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    pressKey("Escape");

    expect(d.getActiveIndex()).toBe(0);
    expect(d.isActive()).toBe(true);
  });
});
