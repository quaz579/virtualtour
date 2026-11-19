import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositionInfo } from "../../src/engine/driver";
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

function stubTarget(targetRect: DOMRect) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "target") {
      return targetRect;
    }
    if (this.classList.contains("vt-popover")) {
      return rect(0, 0, POPOVER.width, POPOVER.height);
    }
    return rect(0, 0, 10, 10);
  });
}

type Setup = {
  side?: "top" | "bottom" | "left" | "right" | "over" | "auto";
  align?: "start" | "center" | "end";
  flip?: boolean;
  shift?: boolean;
  config?: Parameters<typeof createDriver>[0];
};

function show(targetRect: DOMRect, { side = "bottom", align = "start", flip, shift, config }: Setup = {}) {
  stubTarget(targetRect);
  const infos: RepositionInfo[] = [];
  const d = createDriver({
    animate: false,
    stagePadding: 0,
    popoverOffset: 0,
    onReposition: info => infos.push(info),
    ...config,
    steps: [
      {
        element: "#target",
        popover: {
          title: "T",
          side,
          align,
          ...(flip === undefined ? {} : { flip }),
          ...(shift === undefined ? {} : { shift }),
        },
      },
    ],
  });
  d.drive();

  return { wrapper: popoverEl()!, info: infos.at(-1)! };
}

describe("side auto", () => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const layouts: [string, DOMRect, string][] = [
    ["room below", rect(400, 10, 100, 40), "bottom"],
    ["room above", rect(400, H - 68, 100, 40), "top"],
    ["room to the right", rect(10, 300, 100, 400), "right"],
    ["room to the left", rect(W - 110, 300, 100, 400), "left"],
  ];

  for (const [name, target, expected] of layouts) {
    it(`picks the side with the most free space: ${name}`, () => {
      const { info, wrapper } = show(target, { side: "auto" });

      expect(info.side).toBe(expected);
      expect(wrapper.classList.contains(`vt-popover-side-${expected}`)).toBe(true);
      expect(wrapper.getAttribute("data-vt-side")).toBe(expected);
    });
  }

  it("breaks a tie in favor of bottom", () => {
    expect(show(rect(300, H / 2 - 20, 424, 40), { side: "auto" }).info.side).toBe("bottom");
  });

  it("breaks a top and right tie in favor of top", () => {
    expect(show(rect(300, 624, 100, 40), { side: "auto" }).info.side).toBe("top");
  });

  it("uses the boundary, not the viewport, to measure the free space", () => {
    document.body.innerHTML = `<div id="scroller" style="overflow:auto"><button id="target" type="button">T</button></div>`;
    const scroller = document.getElementById("scroller")!;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.id === "target") return rect(100, 250, 100, 40);
      if (this.id === "scroller") return rect(50, 100, 300, 200);
      if (this.classList.contains("vt-popover")) return rect(0, 0, POPOVER.width, POPOVER.height);
      return rect(0, 0, 10, 10);
    });
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });

    const d = createDriver({
      animate: false,
      stagePadding: 0,
      popoverOffset: 0,
      steps: [{ element: "#target", popover: { title: "T", side: "auto" } }],
    });
    d.drive();

    expect(popoverEl()!.getAttribute("data-vt-side")).toBe("top");
  });

  it("reports a concrete side when nothing fits", () => {
    const { info } = show(rect(0, 0, window.innerWidth, window.innerHeight), { side: "auto" });

    expect(info.side).toBe("bottom");
  });
});

describe("flip", () => {
  it("keeps the requested side when flip is off even though the popover overflows the viewport", () => {
    const target = rect(100, window.innerHeight - 68, 100, 40);
    const flipped = show(target, { side: "bottom" });
    expect(flipped.info.side).not.toBe("bottom");
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();

    const { wrapper, info } = show(target, { side: "bottom", flip: false, shift: false });
    expect(info.side).toBe("bottom");
    expect(parseFloat(wrapper.style.bottom)).toBeLessThan(0);
    expect(wrapper.style.top).toBe("auto");
  });

  it("does not center the popover at the bottom when flip is off and nothing fits", () => {
    const { wrapper, info } = show(rect(0, 0, window.innerWidth, window.innerHeight), { side: "left", flip: false });

    expect(info.side).toBe("left");
    expect(wrapper.style.bottom).not.toBe("10px");
    expect(wrapper.querySelector(".vt-popover-arrow")!.classList.contains("vt-popover-arrow-none")).toBe(false);
  });

  it("takes flip from the config default and lets a step override it", () => {
    const target = rect(100, window.innerHeight - 68, 100, 40);

    expect(show(target, { config: { popoverFlip: false } }).info.side).toBe("bottom");
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    expect(show(target, { flip: true, config: { popoverFlip: false } }).info.side).not.toBe("bottom");
  });
});

describe("alignment flip", () => {
  const W = window.innerWidth;

  it("turns start into end when start overflows the edge and end fits", () => {
    const { wrapper, info } = show(rect(W - 124, 400, 100, 40), { side: "top", align: "start" });

    expect(info.side).toBe("top");
    expect(info.align).toBe("end");
    expect(wrapper.style.left).toBe(`${W - 124 - POPOVER.width + 100}px`);
    expect(wrapper.classList.contains("vt-popover-align-end")).toBe(true);
    expect(wrapper.classList.contains("vt-popover-align-start")).toBe(false);
  });

  it("turns end into start when end overflows the edge and start fits", () => {
    const { wrapper, info } = show(rect(10, 400, 100, 40), { side: "top", align: "end" });

    expect(info.align).toBe("start");
    expect(wrapper.style.left).toBe("10px");
  });

  it("keeps the alignment and shifts when flip is off", () => {
    const { wrapper, info } = show(rect(W - 124, 400, 100, 40), { side: "top", align: "start", flip: false });

    expect(info.align).toBe("start");
    expect(wrapper.style.left).toBe(`${W - 10 - POPOVER.width}px`);
  });

  it("keeps the alignment and shifts when the opposite alignment overflows too", () => {
    const { wrapper, info } = show(rect(-20, 400, 40, 40), { side: "top", align: "start" });

    expect(info.align).toBe("start");
    expect(wrapper.style.left).toBe("10px");
  });

  it("has no opposite for center", () => {
    const { wrapper, info } = show(rect(W - 34, 400, 30, 40), { side: "top", align: "center" });

    expect(info.align).toBe("center");
    expect(wrapper.style.left).toBe(`${W - 10 - POPOVER.width}px`);
  });
});

describe("shift", () => {
  it("lets the popover go past the viewport edge when shift is off", () => {
    const target = rect(-40, 400, 100, 40);

    expect(parseFloat(show(target, { side: "top", shift: false }).wrapper.style.left)).toBeLessThan(0);
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    expect(show(target, { side: "top" }).wrapper.style.left).toBe("10px");
  });

  it("skips the side clamp when shift is off", () => {
    document.body.innerHTML = `<div id="scroller" style="overflow:auto"><button id="target" type="button">T</button></div>`;
    const place = (shift: boolean) => {
      vi.restoreAllMocks();
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        if (this.id === "target") return rect(100, 70, 40, 35);
        if (this.id === "scroller") return rect(50, 100, 300, 200);
        if (this.classList.contains("vt-popover")) return rect(0, 0, POPOVER.width, POPOVER.height);
        return rect(0, 0, 10, 10);
      });
      const scroller = document.getElementById("scroller")!;
      Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 300 });
      Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
      const d = createDriver({ animate: false, stagePadding: 0, popoverOffset: 0 });
      d.highlight({ element: "#target", popover: { title: "T", side: "bottom", shift } });
      const bottom = popoverEl()!.style.bottom;
      d.destroy();

      return parseFloat(bottom);
    };

    expect(place(true)).toBe(window.innerHeight - 110 - POPOVER.height);
    expect(place(false)).toBe(window.innerHeight - 105 - POPOVER.height);
  });

  it("takes shift from the config default", () => {
    expect(
      parseFloat(show(rect(-40, 400, 100, 40), { side: "top", config: { popoverShift: false } }).wrapper.style.left)
    ).toBeLessThan(0);
  });
});

describe("targetRect", () => {
  it("is null for a step without a target and the rect for a targeted step", () => {
    const infos: RepositionInfo[] = [];
    const targetRect = rect(100, 100, 100, 40);
    stubTarget(targetRect);
    const d = createDriver({ animate: false, onReposition: info => infos.push(info) });
    d.highlight({ popover: { title: "No target" } });
    expect(infos.at(-1)!.targetRect).toBeNull();
    expect(infos.at(-1)!.side).toBe("over");

    d.highlight({ element: "#target", popover: { title: "Target", side: "over" } });
    expect(infos.at(-1)!.targetRect).not.toBeNull();
    expect(infos.at(-1)!.side).toBe("over");

    d.highlight({ element: "#target", popover: { title: "Target", side: "bottom" } });
    expect(infos.at(-1)!.targetRect).toBe(targetRect);
  });
});
