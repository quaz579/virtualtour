import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, tick, useDriverHarness } from "./utils";

useDriverHarness();

afterEach(() => {
  vi.restoreAllMocks();
});

const NESTED_HTML = `
  <div id="scroller" style="height:100px;overflow:auto">
    <button id="inside" type="button">Inside</button>
    <div style="height:300px"></div>
  </div>
  <div id="other" style="height:100px;overflow:auto"><div style="height:300px"></div></div>
  <button id="outside" type="button">Outside</button>
`;

const steps = [{ element: "#inside", popover: { title: "Inside" } }];

function setup(config: Parameters<typeof createDriver>[0] = {}) {
  document.body.innerHTML = NESTED_HTML;
  const d = createDriver({ animate: false, steps, ...config });
  d.drive(0);
  return d;
}

async function refreshCost(fire: () => void) {
  const target = document.querySelector("#inside")!;
  const spy = vi.spyOn(target, "getBoundingClientRect");
  fire();
  await nextFrame();
  await tick();
  const calls = spy.mock.calls.length;
  spy.mockRestore();
  return calls;
}

describe("scroll capture", () => {
  it("refreshes once when a nested element scrolls, however often it fires in a frame", async () => {
    setup();
    await nextFrame();

    const baseline = await refreshCost(() => window.dispatchEvent(new Event("scroll")));
    expect(baseline).toBeGreaterThan(0);

    const other = document.querySelector("#other")!;
    const nested = await refreshCost(() => {
      other.dispatchEvent(new Event("scroll"));
      other.dispatchEvent(new Event("scroll"));
      other.dispatchEvent(new Event("scroll"));
    });
    expect(nested).toBe(baseline);
  });

  it("refreshes when the target's own scroller scrolls", async () => {
    setup();
    await nextFrame();

    const scroller = document.querySelector("#scroller")!;
    expect(await refreshCost(() => scroller.dispatchEvent(new Event("scroll")))).toBeGreaterThan(0);
  });

  it("stops listening once the tour is destroyed", async () => {
    const d = setup();
    await nextFrame();
    d.destroy();

    const raf = vi.spyOn(window, "requestAnimationFrame");
    document.querySelector("#scroller")!.dispatchEvent(new Event("scroll"));
    expect(raf).not.toHaveBeenCalled();
  });
});

describe("scroll listener wiring", () => {
  it("registers and removes the scroll listener in the capture phase", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const d = setup();
    const added = add.mock.calls.find(call => call[0] === "scroll");
    expect(added?.[2]).toBe(true);
    d.destroy();
    const removed = remove.mock.calls.find(call => call[0] === "scroll");
    expect(removed?.[1]).toBe(added?.[1]);
    expect(removed?.[2]).toBe(true);
  });

  it("schedules one animation frame per scroll burst by cancelling the previous request", async () => {
    setup();
    await nextFrame();
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const other = document.querySelector("#other")!;
    other.dispatchEvent(new Event("scroll"));
    other.dispatchEvent(new Event("scroll"));
    other.dispatchEvent(new Event("scroll"));
    expect(raf).toHaveBeenCalledTimes(3);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("ignores scrolling inside the popover", async () => {
    setup();
    await nextFrame();
    const raf = vi.spyOn(window, "requestAnimationFrame");
    document.querySelector(".vt-popover")!.dispatchEvent(new Event("scroll"));
    expect(raf).not.toHaveBeenCalled();
  });
});

describe("lockScrollParent", () => {
  const parentOf = () => document.querySelector("#scroller")!;

  it("does not lock the scrollable parent by default", () => {
    setup();
    expect(parentOf().hasAttribute("data-vt-target-parent")).toBe(true);
    expect(parentOf().hasAttribute("data-vt-lock-scroll")).toBe(false);
  });

  it("locks the scrollable parent when true and releases it on destroy", () => {
    const d = setup({ lockScrollParent: true });
    expect(parentOf().hasAttribute("data-vt-lock-scroll")).toBe(true);
    d.destroy();
    expect(parentOf().hasAttribute("data-vt-lock-scroll")).toBe(false);
  });

  it("does not lock when false is set explicitly", () => {
    setup({ lockScrollParent: false });
    expect(parentOf().hasAttribute("data-vt-lock-scroll")).toBe(false);
  });
});
