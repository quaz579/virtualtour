import { describe, expect, it, vi } from "vitest";
import type { DriveStep } from "../../src/engine/driver";
import { createDriver, navButton, nextFrame, pressKey, popoverEl, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const frames = async (count = 2) => {
  for (let i = 0; i < count; i += 1) await nextFrame();
};

describe("engine facts the public layer relies on (01-architecture.md §3.2)", () => {
  it("1. onPopoverRender and presenter.mount run after content is applied and before repositionPopover", () => {
    const seen: Array<{ hook: string; title: string | null; left: string }> = [];
    const d = createDriver({
      animate: false,
      onPopoverRender: (popover) =>
        seen.push({ hook: "onPopoverRender", title: popover.title.textContent, left: popover.wrapper.style.left }),
      presenter: {
        mount: (popover) =>
          seen.push({ hook: "mount", title: popover.title.textContent, left: popover.wrapper.style.left }),
      },
      steps: SAMPLE_STEPS,
    });
    d.drive();

    expect(seen.map((s) => s.hook)).toEqual(["onPopoverRender", "mount"]);
    for (const entry of seen) {
      expect(entry.title).toBe("Step 1");
      expect(entry.left).toBe("");
    }
    expect(popoverEl()?.style.left).toMatch(/px$/);
  });

  it("2. renderStepPopover destroys the previous popover and creates a new one per step; updatePopover() reuses the wrapper", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await frames();
    const first = popoverEl();
    d.moveNext();
    await frames();
    const second = popoverEl();

    expect(second).not.toBe(first);
    expect(first?.isConnected).toBe(false);
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);

    d.updatePopover({ title: "Changed" });
    expect(popoverEl()).toBe(second);
    expect(popoverEl()?.querySelector(".vt-popover-title")?.textContent).toBe("Changed");
  });

  it("3. applyPopoverContent touches only the elements in PopoverDOM; children added next to them survive updatePopover()", async () => {
    const d = createDriver({
      animate: false,
      onPopoverRender: (popover) => {
        const extra = document.createElement("div");
        extra.className = "layer-part";
        popover.wrapper.append(extra);
      },
      steps: SAMPLE_STEPS,
    });
    d.drive();
    await frames();
    const extra = popoverEl()?.querySelector(".layer-part");
    expect(extra).not.toBeNull();

    d.updatePopover({ title: "Changed", description: "New text", showButtons: ["close"] });

    expect(popoverEl()?.querySelector(".layer-part")).toBe(extra);
    expect(popoverEl()?.querySelector(".vt-popover-title")?.textContent).toBe("Changed");
  });

  it("4. setConfig() replaces the config without teardown, drive() reads steps from the config on every call, setSteps() tears down", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await frames();
    const wrapper = popoverEl();

    const replacement: DriveStep[] = [
      { popover: { title: "New 1", description: "a" } },
      { popover: { title: "New 2", description: "b" } },
    ];
    d.setConfig({ ...d.getConfig(), steps: replacement });
    expect(d.isActive()).toBe(true);
    expect(popoverEl()).toBe(wrapper);

    d.drive(1);
    await frames();
    expect(popoverEl()?.querySelector(".vt-popover-title")?.textContent).toBe("New 2");

    d.setSteps(SAMPLE_STEPS);
    expect(d.isActive()).toBe(false);
    expect(popoverEl()).toBeNull();
  });

  it("5. hook order on a step change is onDeselected(from), onHighlightStarted(to), popover render, onHighlighted(to)", async () => {
    const order: string[] = [];
    const d = createDriver({
      animate: false,
      onDeselected: (_el, step) => order.push(`deselected:${step.popover?.title}`),
      onHighlightStarted: (_el, step) => order.push(`started:${step.popover?.title}`),
      onPopoverRender: (popover) => order.push(`render:${popover.title.textContent}`),
      onHighlighted: (_el, step) => order.push(`highlighted:${step.popover?.title}`),
      steps: SAMPLE_STEPS,
    });
    d.drive();
    await frames();
    order.length = 0;
    d.moveNext();
    await frames();

    expect(order).toEqual(["deselected:Step 1", "started:Step 2", "render:Step 2", "highlighted:Step 2"]);
  });

  it("6. destroy(reason) with onDestroyStarted set returns before tearing down; destroy() from the hook runs onDeselected then onDestroyed with the original reason", async () => {
    const order: string[] = [];
    const reasons: Array<string | undefined> = [];
    let hookReason: string | undefined;
    const d = createDriver({
      animate: false,
      onDestroyStarted: (_el, _step, opts) => {
        hookReason = opts.reason;
        order.push("destroyStarted");
      },
      onDeselected: () => order.push("deselected"),
      onDestroyed: (_el, _step, opts) => {
        order.push("destroyed");
        reasons.push(opts.reason);
      },
      steps: SAMPLE_STEPS,
    });
    d.drive();
    await frames();

    pressKey("Escape");
    expect(order).toEqual(["destroyStarted"]);
    expect(d.isActive()).toBe(true);
    expect(hookReason).toBe("escape");

    d.destroy();
    expect(order).toEqual(["destroyStarted", "deselected", "destroyed"]);
    expect(reasons).toEqual(["escape"]);
    expect(d.isActive()).toBe(false);
  });

  it("7. Next/Back buttons and ArrowRight/ArrowLeft call onNextClick/onPrevClick instead of moving when those hooks exist", async () => {
    const onNextClick = vi.fn();
    const onPrevClick = vi.fn();
    const d = createDriver({ animate: false, onNextClick, onPrevClick, steps: SAMPLE_STEPS });
    d.drive(1);
    await frames();

    navButton("next")?.click();
    expect(onNextClick).toHaveBeenCalledTimes(1);
    pressKey("ArrowRight");
    expect(onNextClick).toHaveBeenCalledTimes(2);
    navButton("prev")?.click();
    expect(onPrevClick).toHaveBeenCalledTimes(1);
    pressKey("ArrowLeft");
    expect(onPrevClick).toHaveBeenCalledTimes(2);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("8. a new popover focuses Next when usable and else the wrapper; the Tab trap covers wrapper and target; focus returns to the pre-tour element on destroy", async () => {
    const start = document.createElement("button");
    start.id = "start";
    document.body.append(start);
    start.focus();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(1);
    await frames();

    expect(document.activeElement).toBe(navButton("next"));

    const visible = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockReturnValue([new DOMRect(0, 0, 1, 1)] as unknown as DOMRectList);
    const reachable = new Set<Element | null>();
    for (let i = 0; i < 8; i += 1) {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      reachable.add(document.activeElement);
    }
    const wrapper = popoverEl() as HTMLElement;
    for (const el of reachable) {
      expect(el === document.querySelector("#card-1") || wrapper.contains(el)).toBe(true);
    }
    expect(reachable.has(document.querySelector("#card-1"))).toBe(true);
    expect([...reachable].some((el) => wrapper.contains(el))).toBe(true);
    visible.mockRestore();

    d.destroy();
    expect(document.activeElement).toBe(start);

    const noButtons = createDriver({
      animate: false,
      steps: [{ popover: { title: "Only", description: "x", showButtons: [] } }],
    });
    noButtons.drive();
    await frames();
    expect(document.activeElement).toBe(popoverEl());
  });

  it("9. keys are handled on keyup", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await frames();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(d.getActiveIndex()).toBe(0);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight" }));
    expect(d.getActiveIndex()).toBe(1);
  });

  it("10. advanceOn only listens for events whose path includes the active element", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#card-1", advanceOn: "click", popover: { title: "A", description: "x" } },
        { popover: { title: "B", description: "y" } },
      ],
    });
    d.drive();
    await frames();

    document.querySelector<HTMLElement>("#intro")?.click();
    await frames();
    expect(d.getActiveIndex()).toBe(0);

    document.querySelector<HTMLElement>("#card-1")?.click();
    await frames();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("11. progress placeholders are {{current}} and {{total}}", async () => {
    const d = createDriver({ animate: false, showProgress: true, progressText: "{{current}} of {{total}}", steps: SAMPLE_STEPS });
    d.drive(1);
    await frames();

    expect(popoverEl()?.querySelector(".vt-popover-progress-text")?.textContent?.trim()).toBe("2 of 3");
  });
});
