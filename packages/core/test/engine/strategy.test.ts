import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

const SCROLL_Y = 300;

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

afterEach(() => {
  vi.restoreAllMocks();
});

function stubLayout() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "intro") {
      return rect(100, 200, 100, 40);
    }
    if (this.classList.contains("vt-popover")) {
      const absolute = this.getAttribute("data-vt-strategy") === "absolute";
      const style = (this as HTMLElement).style;
      const left = parseFloat(style.left) || 0;
      const top = parseFloat(style.top) || 0;
      return rect(left, absolute ? top - SCROLL_Y : top, 200, 100);
    }
    return rect(0, 0, 10, 10);
  });
}

function viewportTop(wrapper: HTMLElement) {
  return wrapper.style.top === "auto"
    ? window.innerHeight - parseFloat(wrapper.style.bottom) - 100
    : parseFloat(wrapper.style.top);
}

function place(strategy: "fixed" | "absolute" | undefined, side: "bottom" | "top" | "over" = "bottom") {
  stubLayout();
  const driver = createDriver({
    animate: false,
    steps: [{ element: "#intro", popover: { title: "Only", side, ...(strategy ? { strategy } : {}) } }],
  });
  driver.drive();

  return Object.assign(popoverEl()!, { driver });
}

describe("popover strategy", () => {
  it("keeps the default fixed math and attribute-free wrapper", () => {
    const wrapper = place(undefined);

    expect(wrapper.hasAttribute("data-vt-strategy")).toBe(false);
    expect(wrapper.style.bottom).toMatch(/px$/);
    expect(wrapper.style.top).toBe("auto");
  });

  it("absolute writes coordinates relative to the containing block", () => {
    const fixed = place("fixed");
    const fixedTop = viewportTop(fixed);
    const fixedLeft = parseFloat(fixed.style.left);
    fixed.driver.destroy();

    const wrapper = place("absolute");

    expect(wrapper.getAttribute("data-vt-strategy")).toBe("absolute");
    expect(parseFloat(wrapper.style.top)).toBe(fixedTop + SCROLL_Y);
    expect(parseFloat(wrapper.style.left)).toBe(fixedLeft);
  });

  it("absolute never writes bottom or right offsets", () => {
    const wrapper = place("absolute", "top");

    expect(wrapper.style.bottom).toBe("auto");
    expect(wrapper.style.right).toBe("auto");
    expect(wrapper.style.top).toMatch(/px$/);
    expect(wrapper.style.left).toMatch(/px$/);
  });

  it("centered steps ignore the strategy", () => {
    const wrapper = place("absolute", "over");

    expect(wrapper.hasAttribute("data-vt-strategy")).toBe(false);
    expect(wrapper.style.top).toBe(`${window.innerHeight / 2 - 50}px`);
  });

  it("switches back to fixed when the next step is centered", () => {
    stubLayout();
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "A", side: "bottom", strategy: "absolute" } },
        { element: "#intro", popover: { title: "B", side: "over", strategy: "absolute" } },
      ],
    });
    d.drive();
    expect(popoverEl()!.getAttribute("data-vt-strategy")).toBe("absolute");

    d.moveNext();
    expect(popoverEl()!.hasAttribute("data-vt-strategy")).toBe(false);
  });
});
