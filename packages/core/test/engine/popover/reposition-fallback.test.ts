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

describe("popover position option sanitizing", () => {
  const place = (extra: Record<string, unknown>) => {
    stubLayout(rect(300, 300, 100, 40));
    const d = createDriver({
      animate: false,
      steps: [{ element: "#intro", popoverOffset: 10, popover: { title: "Only", side: "bottom", align: "start" }, ...extra }],
    });
    d.drive();
    const wrapper = popoverEl()!;
    const tip = wrapper.querySelector<HTMLElement>(".vt-popover-arrow")!;
    const placed = { left: wrapper.style.left, top: wrapper.style.top, arrow: tip.style.left || tip.style.top };
    d.destroy();
    return placed;
  };

  it("treats a non-finite cross offset as zero", () => {
    const baseline = place({});
    for (const popoverCrossOffset of [NaN, Infinity, -Infinity]) {
      const placed = place({ popoverCrossOffset });
      expect(placed).toEqual(baseline);
      expect(`${placed.left}${placed.top}`).not.toMatch(/NaN|Infinity/);
    }
  });

  it("clamps a negative arrow minimum inset to zero and ignores a non-finite one", () => {
    const clamped = place({ popover: { title: "Only", side: "bottom", align: "start", arrowMinInset: 0 } });
    expect(place({ popover: { title: "Only", side: "bottom", align: "start", arrowMinInset: -40 } })).toEqual(clamped);
    const fallback = place({});
    expect(place({ popover: { title: "Only", side: "bottom", align: "start", arrowMinInset: NaN } })).toEqual(fallback);
  });
});
