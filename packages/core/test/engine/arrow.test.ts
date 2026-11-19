import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateArrowOffset, calculateArrowTarget } from "../../src/engine/popover/position";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

const POPOVER = { width: 200, height: 100 };

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  document.body.innerHTML = `<button id="target" type="button">T</button>`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Setup = {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  arrow?: boolean;
  arrowMinInset?: number;
  offset?: number;
};

function show(targetRect: DOMRect, { side = "bottom", align = "start", arrow, arrowMinInset, offset = 0 }: Setup = {}) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "target") return targetRect;
    if (this.classList.contains("vt-popover")) {
      const style = (this as HTMLElement).style;
      const left = style.left === "auto" ? window.innerWidth - parseFloat(style.right) - POPOVER.width : parseFloat(style.left) || 0;
      const top = style.top === "auto" ? window.innerHeight - parseFloat(style.bottom) - POPOVER.height : parseFloat(style.top) || 0;
      return rect(left, top, POPOVER.width, POPOVER.height);
    }
    return rect(0, 0, 10, 10);
  });
  const driver = createDriver({
    animate: false,
    stagePadding: 0,
    popoverOffset: offset,
    steps: [
      {
        element: "#target",
        popover: {
          title: "T",
          side,
          align,
          ...(arrow === undefined ? {} : { arrow }),
          ...(arrowMinInset === undefined ? {} : { arrowMinInset }),
        },
      },
    ],
  });
  driver.drive();

  return { wrapper: popoverEl()!, arrow: document.querySelector<HTMLElement>(".vt-popover-arrow")! };
}

const WIDE = rect(300, 300, 400, 40);

describe("minInset", () => {
  it("defaults to 15 at the start corner", () => {
    expect(parseFloat(show(WIDE, { align: "start" }).arrow.style.left)).toBe(15);
  });

  it("keeps the arrow 30 from the start corner", () => {
    expect(parseFloat(show(WIDE, { align: "start", arrowMinInset: 30 }).arrow.style.left)).toBe(30);
  });

  it("keeps the arrow 30 from the end corner", () => {
    const left = parseFloat(show(WIDE, { align: "end", arrowMinInset: 30 }).arrow.style.left);
    expect(POPOVER.width - left - 10).toBe(30);
  });

  it("clamps an arrow over a target corner to the inset", () => {
    const narrow = rect(402, 300, 6, 40);
    expect(parseFloat(show(narrow, { align: "start", arrowMinInset: 30 }).arrow.style.left)).toBe(30);
  });

  it("applies on the vertical axis", () => {
    const tall = rect(500, 200, 100, 400);
    expect(parseFloat(show(tall, { side: "right", align: "start", arrowMinInset: 30 }).arrow.style.top)).toBe(30);
  });

  it("centers when the popover is shorter than two insets", () => {
    expect(calculateArrowOffset(0, 40, 10, 30)).toBe(15);
  });

  it("calculateArrowTarget honors minInset", () => {
    expect(calculateArrowTarget(0, 1000, 100, 300, "start", 10, 30)).toBe(35);
    expect(calculateArrowTarget(0, 1000, 100, 300, "end", 10, 30)).toBe(165);
  });
});

describe("arrow false", () => {
  it("hides the arrow and marks the wrapper", () => {
    const { wrapper, arrow } = show(WIDE, { arrow: false });
    expect(arrow.classList.contains("vt-popover-arrow-none")).toBe(true);
    expect(wrapper.classList.contains("vt-no-arrow")).toBe(true);
  });

  it("keeps the arrow and the wrapper class off by default", () => {
    const { wrapper, arrow } = show(WIDE);
    expect(arrow.classList.contains("vt-popover-arrow-none")).toBe(false);
    expect(wrapper.classList.contains("vt-no-arrow")).toBe(false);
  });

  it("sits offset pixels from the target", () => {
    const { wrapper } = show(WIDE, { arrow: false, offset: 12 });
    const top = window.innerHeight - parseFloat(wrapper.style.bottom) - POPOVER.height;
    expect(top - 340).toBe(12);
  });

  it("drops the arrow allowance from the edge margin", () => {
    const edge = rect(2, 300, 100, 40);
    expect(parseFloat(show(edge, { arrow: true }).wrapper.style.left)).toBe(10);
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    expect(parseFloat(show(edge, { arrow: false }).wrapper.style.left)).toBe(2);
  });
});
