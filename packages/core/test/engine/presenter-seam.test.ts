import { describe, expect, it, vi } from "vitest";
import type { DriveStep, EnginePresenter, RepositionInfo } from "../../src/engine/driver";
import { createDriver, popoverEl, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("presenter seam", () => {
  it("runs presenter.mount after the content is applied and before the popover is positioned", () => {
    const seen: Array<{ title: string | undefined; left: string | undefined; step: DriveStep }> = [];
    const presenter: EnginePresenter = {
      mount(popover, step) {
        seen.push({ title: popover.title.textContent ?? undefined, left: popover.wrapper.style.left, step });
      },
    };

    const d = createDriver({ animate: false, presenter, steps: SAMPLE_STEPS });
    d.drive();

    expect(seen).toHaveLength(1);
    expect(seen[0]!.title).toBe("Step 1");
    expect(seen[0]!.left).toBe("");
    expect(seen[0]!.step).toBe(d.getActiveStep());
    expect(popoverEl()?.style.left).toMatch(/px$/);
  });

  it("runs presenter.mount after onPopoverRender", () => {
    const order: string[] = [];
    const d = createDriver({
      animate: false,
      onPopoverRender: () => order.push("onPopoverRender"),
      presenter: { mount: () => order.push("mount") },
      steps: SAMPLE_STEPS,
    });
    d.drive();

    expect(order).toEqual(["onPopoverRender", "mount"]);
  });

  it("does not call mount again when the popover content is updated in place", () => {
    const mount = vi.fn();
    const d = createDriver({ animate: false, presenter: { mount }, steps: SAMPLE_STEPS });
    d.drive();
    d.updatePopover({ title: "Changed" });

    expect(mount).toHaveBeenCalledTimes(1);
  });

  it("mounts once per rendered step", () => {
    const mount = vi.fn();
    const d = createDriver({ animate: false, presenter: { mount }, steps: SAMPLE_STEPS });
    d.drive();
    d.moveNext();

    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1]![1]).toBe(d.getActiveStep());
  });

  it("fires onReposition once per render and once per refresh with the rendered side", async () => {
    const onReposition = vi.fn<(info: RepositionInfo) => void>();
    const afterReposition = vi.fn<(info: RepositionInfo) => void>();
    const d = createDriver({
      animate: false,
      onReposition,
      presenter: { mount: () => undefined, afterReposition },
      steps: [{ ...SAMPLE_STEPS[0], popover: { ...SAMPLE_STEPS[0].popover, side: "bottom" } }, SAMPLE_STEPS[1]],
    });
    d.drive();

    expect(onReposition).toHaveBeenCalledTimes(1);
    expect(afterReposition).toHaveBeenCalledTimes(1);
    const info = onReposition.mock.calls[0]![0];
    expect(info.side).toBe(popoverEl()?.getAttribute("data-vt-side"));
    expect(info.align).toBe("start");
    expect(info.targetRect).not.toBeNull();
    expect(info.wrapperRect).toBeDefined();

    d.refresh();
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    expect(onReposition).toHaveBeenCalledTimes(2);
    expect(afterReposition).toHaveBeenCalledTimes(2);
  });

  it("passes hook options to onReposition", () => {
    const onReposition = vi.fn();
    const d = createDriver({ animate: false, onReposition, steps: SAMPLE_STEPS });
    d.drive();

    expect(onReposition.mock.calls[0]![1]).toMatchObject({ driver: d, index: 0 });
  });

  it("reports a null targetRect for a step without an element", () => {
    const onReposition = vi.fn<(info: RepositionInfo) => void>();
    const d = createDriver({
      animate: false,
      onReposition,
      steps: [{ popover: { title: "Centered", description: "No target" } }],
    });
    d.drive();

    expect(onReposition.mock.calls[0]![0].targetRect).toBeNull();
    expect(onReposition.mock.calls[0]![0].side).toBe("over");
  });

  it("fires onReposition again when an image in the popover finishes loading", () => {
    const onReposition = vi.fn();
    const d = createDriver({
      animate: false,
      onReposition,
      steps: [{ element: "#intro", popover: { title: "Image", description: '<img src="about:blank" alt="">' } }],
    });
    d.drive();
    const before = onReposition.mock.calls.length;

    popoverEl()!.querySelector("img")!.dispatchEvent(new Event("load"));

    expect(onReposition).toHaveBeenCalledTimes(before + 1);
  });
});
