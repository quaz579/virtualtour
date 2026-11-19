import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositionInfo } from "../../src/engine/driver";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

function place(targetRect: DOMRect, config: Record<string, unknown> = {}) {
  document.body.innerHTML = `<div id="scroller" style="overflow:auto"><button id="target" type="button">T</button></div>`;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "target") {
      return targetRect;
    }
    if (this.id === "scroller") {
      return rect(0, 100, 300, 200);
    }
    if (this.classList.contains("vt-popover")) {
      return rect(0, 0, 200, 100);
    }
    return rect(0, 0, 10, 10);
  });
  const scroller = document.getElementById("scroller")!;
  Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 300 });
  Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
  const infos: RepositionInfo[] = [];
  const d = createDriver({ animate: false, popoverOffset: 0, stagePadding: 0, onReposition: i => infos.push(i), ...config });
  d.highlight({ element: "#target", popover: { title: "T", side: "bottom", align: "center" } });

  return { wrapper: popoverEl()!, info: infos.at(-1)! };
}

describe("anchor wider than its scrolling panel", () => {
  it("keeps a bottom popover inside the panel instead of centering on the hidden part of the anchor", () => {
    const { wrapper, info } = place(rect(50, 120, 1000, 40));
    const left = parseFloat(wrapper.style.left);

    expect(info.side).toBe("bottom");
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + 200).toBeLessThanOrEqual(300);
  });

  it("lets the popover leave the panel when the boundary is the viewport", () => {
    const { wrapper } = place(rect(50, 120, 1000, 40), { popoverBoundary: "viewport" });

    expect(parseFloat(wrapper.style.left) + 200).toBeGreaterThan(300);
  });
});
