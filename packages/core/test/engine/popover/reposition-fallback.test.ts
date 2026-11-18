import { afterEach, describe, expect, it, vi } from "vitest";
import type { RepositionInfo } from "../../../src/engine/driver";
import { createDriver, popoverEl, useDriverHarness } from "../utils";

useDriverHarness();

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

afterEach(() => {
  vi.restoreAllMocks();
});

function stubLayout(targetRect: DOMRect) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "intro") {
      return targetRect;
    }
    if (this.classList.contains("vt-popover")) {
      return rect(0, 0, 200, 100);
    }
    return rect(0, 0, 10, 10);
  });
}

describe("popover placement when no side fits", () => {
  it("pins the popover to the bottom center and reports the requested side with the arrow hidden", () => {
    stubLayout(rect(0, 0, window.innerWidth, window.innerHeight));
    const onReposition = vi.fn<(info: RepositionInfo) => void>();
    const d = createDriver({
      animate: false,
      onReposition,
      steps: [{ element: "#intro", popover: { title: "Only", side: "left", align: "start" } }],
    });
    d.drive();

    const wrapper = popoverEl()!;
    expect(wrapper.style.bottom).toBe("10px");
    expect(wrapper.style.top).toBe("auto");
    expect(wrapper.style.left).toBe(`${window.innerWidth / 2 - 100}px`);
    expect(wrapper.querySelector(".vt-popover-arrow")?.classList.contains("vt-popover-arrow-none")).toBe(true);

    expect(onReposition).toHaveBeenCalled();
    const info = onReposition.mock.calls.at(-1)![0];
    expect(info.side).toBe("left");
    expect(info.align).toBe("start");
    expect(wrapper.classList.contains("vt-popover-side-left")).toBe(true);
  });

  it("reports the side it actually used when one fits", () => {
    stubLayout(rect(0, 350, 100, 50));
    const onReposition = vi.fn<(info: RepositionInfo) => void>();
    const d = createDriver({
      animate: false,
      onReposition,
      steps: [{ element: "#intro", popover: { title: "Only", side: "left" } }],
    });
    d.drive();

    expect(onReposition.mock.calls.at(-1)![0].side).toBe("right");
    expect(popoverEl()!.style.bottom).not.toBe("10px");
  });
});
