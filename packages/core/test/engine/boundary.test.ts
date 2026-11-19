import { afterEach, describe, expect, it, vi } from "vitest";
import type { RepositionInfo } from "../../src/engine/driver";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

const POPOVER = { width: 200, height: 100 };

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

afterEach(() => {
  vi.restoreAllMocks();
});

function stubLayout(rects: Record<string, DOMRect>, clientSizes: Record<string, [number, number]> = {}) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id && rects[this.id]) {
      return rects[this.id]!;
    }
    if (this.classList.contains("vt-popover")) {
      return rect(0, 0, POPOVER.width, POPOVER.height);
    }
    return rect(0, 0, 10, 10);
  });
  for (const [id, [width, height]] of Object.entries(clientSizes)) {
    const element = document.getElementById(id)!;
    Object.defineProperty(element, "clientWidth", { configurable: true, value: width });
    Object.defineProperty(element, "clientHeight", { configurable: true, value: height });
  }
}

function placeInScroller(targetRect: DOMRect, scrollerRect: DOMRect, size: [number, number]) {
  document.body.innerHTML = `
    <div id="scroller" style="overflow:auto"><button id="target" type="button">T</button></div>
  `;
  stubLayout({ target: targetRect, scroller: scrollerRect }, { scroller: size });
}

function show(config: Parameters<typeof createDriver>[0], side: "top" | "bottom" | "left" | "right" | "over" = "bottom") {
  const infos: RepositionInfo[] = [];
  const d = createDriver({
    animate: false,
    onReposition: info => infos.push(info),
    ...config,
    steps: [{ element: "#target", popover: { title: "T", side, align: "start" } }],
  });
  d.drive();

  return { wrapper: popoverEl()!, info: infos.at(-1)! };
}

describe("popoverPadding", () => {
  it("keeps a bottom popover that fits exactly at padding 0", () => {
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    const bottom = window.innerHeight - 100;
    stubLayout({ target: rect(100, bottom - 40, 100, 40) });

    expect(show({ stagePadding: 0, popoverOffset: 0 }).info.side).toBe("bottom");
  });

  it("leaves the bottom side once padding pushes the popover past the padded viewport", () => {
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    const bottom = window.innerHeight - 100;
    stubLayout({ target: rect(100, bottom - 40, 100, 40) });

    expect(show({ stagePadding: 0, popoverOffset: 0, popoverPadding: 20 }).info.side).not.toBe("bottom");
  });

  it("lets a step override the config padding", () => {
    const sideOf = (stepPadding: number) => {
      document.body.innerHTML = `<button id="target" type="button">T</button>`;
      stubLayout({ target: rect(100, window.innerHeight - 140, 100, 40) });
      const d = createDriver({ animate: false, stagePadding: 0, popoverOffset: 0, popoverPadding: 0 });
      d.highlight({ element: "#target", popoverPadding: stepPadding, popover: { title: "T", side: "bottom" } });
      const side = popoverEl()!.classList.contains("vt-popover-side-bottom") ? "bottom" : "other";
      d.destroy();

      return side;
    };

    expect(sideOf(0)).toBe("bottom");
    expect(sideOf(20)).toBe("other");
  });

  it("keeps a top popover inside the padded viewport edge", () => {
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    stubLayout({ target: rect(100, 110, 100, 40) });

    expect(show({ stagePadding: 0, popoverOffset: 0, popoverPadding: 20 }, "top").info.side).not.toBe("top");
    expect(show({ stagePadding: 0, popoverOffset: 0, popoverPadding: 0 }, "top").info.side).toBe("top");
  });
});

describe("popoverBoundary", () => {
  it("flips to top when the popover would cross the bottom of a scroller", () => {
    placeInScroller(rect(100, 230, 100, 40), rect(50, 100, 300, 200), [300, 200]);

    const { info } = show({ stagePadding: 0, popoverOffset: 0 });
    expect(info.side).toBe("top");
  });

  it("ignores scroll parents when the boundary is the viewport", () => {
    placeInScroller(rect(100, 230, 100, 40), rect(50, 100, 300, 200), [300, 200]);

    const { info } = show({ stagePadding: 0, popoverOffset: 0, popoverBoundary: "viewport" });
    expect(info.side).toBe("bottom");
  });

  it("falls back to the viewport on an axis the scroller is too small for", () => {
    placeInScroller(rect(60, 230, 40, 40), rect(50, 100, 150, 200), [150, 200]);

    const { wrapper, info } = show({ stagePadding: 0, popoverOffset: 0 }, "top");
    expect(info.side).toBe("top");
    expect(parseFloat(wrapper.style.left)).toBeGreaterThanOrEqual(0);
  });

  it("uses the viewport when no side fits inside the scroller", () => {
    placeInScroller(rect(100, 150, 100, 40), rect(50, 100, 300, 120), [300, 120]);

    const { wrapper, info } = show({ stagePadding: 0, popoverOffset: 0 });
    expect(info.side).toBe("bottom");
    expect(wrapper.style.bottom).not.toBe("10px");
  });

  it("keeps the popover clear of the scroller's left edge", () => {
    placeInScroller(rect(60, 250, 40, 40), rect(50, 100, 300, 200), [300, 200]);

    const { wrapper } = show({ stagePadding: 0, popoverOffset: 0 }, "top");
    expect(parseFloat(wrapper.style.left)).toBeGreaterThanOrEqual(50);
  });
});

describe("side over", () => {
  it("highlights a real element and centers the popover without an arrow", () => {
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    stubLayout({ target: rect(100, 100, 100, 40) });

    const { wrapper, info } = show({}, "over");

    expect(document.getElementById("target")!.hasAttribute("data-vt-target")).toBe(true);
    expect(info.side).toBe("over");
    expect(wrapper.style.left).toBe(`${window.innerWidth / 2 - POPOVER.width / 2}px`);
    expect(wrapper.style.top).toBe(`${window.innerHeight / 2 - POPOVER.height / 2}px`);
    expect(wrapper.querySelector(".vt-popover-arrow")!.classList.contains("vt-popover-arrow-none")).toBe(true);
  });
});
