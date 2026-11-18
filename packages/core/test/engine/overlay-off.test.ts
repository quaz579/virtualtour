import { describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, popoverEl, SAMPLE_STEPS, tick, useDriverHarness } from "./utils";

useDriverHarness();

describe("overlay: false", () => {
  it("draws no overlay and no dim marker but keeps the tour active and the target marked", async () => {
    const d = createDriver({ animate: false, overlay: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(document.querySelector("[data-vt-overlay]")).toBeNull();
    expect(document.body.hasAttribute("data-vt-active")).toBe(true);
    expect(document.body.hasAttribute("data-vt-dim")).toBe(false);
    expect(document.querySelector("#intro")?.hasAttribute("data-vt-target")).toBe(true);
  });

  it("positions the popover", async () => {
    const d = createDriver({ animate: false, overlay: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(popoverEl()?.style.left).toMatch(/px$/);
  });

  it("draws the overlay and the dim marker by default", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(document.querySelector("[data-vt-overlay]")).not.toBeNull();
    expect(document.body.hasAttribute("data-vt-dim")).toBe(true);
  });

  it("still draws the overlay when overlay is true", async () => {
    const d = createDriver({ animate: false, overlay: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(document.querySelector("[data-vt-overlay]")).not.toBeNull();
    expect(document.body.hasAttribute("data-vt-dim")).toBe(true);
  });

  it("lets a page button outside the tour receive clicks", async () => {
    const onClick = vi.fn();
    document.body.insertAdjacentHTML("beforeend", `<button id="outside" type="button">Outside</button>`);
    document.querySelector("#outside")!.addEventListener("click", onClick);

    const d = createDriver({ animate: false, overlay: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    document.querySelector<HTMLElement>("#outside")!.click();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(d.isActive()).toBe(true);
  });

  it("skips the stage tween and still renders the popover when animate is on", async () => {
    const d = createDriver({ animate: true, duration: 200, overlay: false, steps: SAMPLE_STEPS });
    d.drive();
    d.moveNext();

    expect(popoverEl()?.querySelector(".vt-popover-title")?.textContent).toBe("Step 2");
    await nextFrame();
    await nextFrame();

    expect(document.querySelector("[data-vt-overlay]")).toBeNull();
    expect(d.getState("__activeStagePosition")).toBeDefined();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("clears the body markers on destroy", async () => {
    const d = createDriver({ animate: false, overlay: false, steps: SAMPLE_STEPS });
    d.drive();
    await tick();
    d.destroy();

    expect(document.body.hasAttribute("data-vt-active")).toBe(false);
    expect(document.body.hasAttribute("data-vt-dim")).toBe(false);
  });
});
