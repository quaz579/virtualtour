import { describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const frames = async (count: number) => {
  for (let i = 0; i < count; i += 1) {
    await nextFrame();
  }
};

describe("overlay: false with animate: true", () => {
  it("skips the stage tween so the highlighted hook fires on the first frame", async () => {
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: true, duration: 5000, overlay: false, onHighlighted, steps: SAMPLE_STEPS });
    d.drive();
    await frames(2);
    onHighlighted.mockClear();

    d.moveNext();
    await frames(3);

    expect(onHighlighted).toHaveBeenCalledTimes(1);
    expect(onHighlighted.mock.calls[0]![1].popover?.title).toBe("Step 2");
  });

  it("renders the next popover synchronously instead of waiting for the tween midpoint", async () => {
    const d = createDriver({ animate: true, duration: 5000, overlay: false, steps: SAMPLE_STEPS });
    d.drive();
    await frames(2);

    d.moveNext();

    expect(popoverEl()).not.toBeNull();
    expect(popoverEl()?.querySelector(".vt-popover-title")?.textContent).toBe("Step 2");
  });

  it("still runs the tween when the overlay is on", async () => {
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: true, duration: 5000, onHighlighted, steps: SAMPLE_STEPS });
    d.drive();
    await frames(2);
    onHighlighted.mockClear();

    d.moveNext();
    await frames(3);

    expect(onHighlighted).not.toHaveBeenCalled();
  });
});
