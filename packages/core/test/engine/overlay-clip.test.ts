import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, useDriverHarness } from "./utils";
import { clipRectByScrollParents } from "../../src/engine/core/utils";
import { compileTour } from "../../src/compile";
import { normalizeTourConfig } from "../../src/config";
import { createEngine, type Config } from "../../src/engine/driver";

useDriverHarness();

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const rect = (x: number, y: number, width: number, height: number): DOMRect => new DOMRect(x, y, width, height);

const stub = (element: Element, value: DOMRect) => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(value);
};

function mount(options: { itemStyle?: string; scrollerStyle?: string } = {}) {
  const scroller = document.createElement("div");
  scroller.id = "scroller";
  scroller.style.cssText = options.scrollerStyle ?? "overflow-x:auto;overflow-y:auto";
  const item = document.createElement("div");
  item.id = "item";
  item.style.cssText = options.itemStyle ?? "";
  scroller.appendChild(item);
  document.body.appendChild(scroller);
  stub(scroller, rect(0, 100, 300, 200));
  return { scroller, item };
}

const lastSubpath = () => document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!.split("M").at(-1)!;

const hole = () => {
  const d = lastSubpath();
  return {
    width: Number(/h(-?\d+(?:\.\d+)?) /.exec(d)![1]),
    height: Number(/v(-?\d+(?:\.\d+)?) /.exec(d)![1]),
  };
};

describe("clipRectByScrollParents", () => {
  it("intersects the rect with the padding box of a clipping ancestor", () => {
    const { item } = mount();
    const clipped = clipRectByScrollParents(item, rect(10, 220, 100, 200));

    expect(clipped.top).toBe(220);
    expect(clipped.height).toBe(80);
    expect(clipped.left).toBe(10);
    expect(clipped.width).toBe(100);
  });

  it("clips by overflow hidden and only on the clipping axis", () => {
    const { item } = mount({ scrollerStyle: "overflow-x:visible;overflow-y:hidden" });
    const clipped = clipRectByScrollParents(item, rect(250, 220, 200, 200));

    expect(clipped.width).toBe(200);
    expect(clipped.height).toBe(80);
  });

  it("ignores ancestors that do not clip", () => {
    const { item } = mount({ scrollerStyle: "overflow-x:visible;overflow-y:visible" });
    const raw = rect(10, 220, 100, 200);

    expect(clipRectByScrollParents(item, raw).height).toBe(200);
  });

  it("returns an empty rect for an element scrolled fully out", () => {
    const { item } = mount();
    const clipped = clipRectByScrollParents(item, rect(10, 400, 100, 50));

    expect(clipped.height).toBe(0);
    expect(clipped.width).toBe(100);
  });
});

describe("overlay clipping", () => {
  const run = async (config: Record<string, unknown>, element = "#item") => {
    const d = createDriver({ animate: false, stagePadding: 0, stageRadius: 0, ...config });
    d.highlight({ element, popover: { title: "t" } });
    await nextFrame();
    return d;
  };

  it("cuts out only the visible 80px of a 200px element", async () => {
    const { item } = mount();
    stub(item, rect(10, 220, 100, 200));
    await run({});

    expect(hole()).toEqual({ width: 100, height: 80 });
  });

  it("does not clip a fixed-position element inside a scroller", async () => {
    const { item } = mount({ itemStyle: "position:fixed" });
    stub(item, rect(10, 220, 100, 200));
    await run({});

    expect(hole().height).toBe(200);
  });

  it("keeps the raw rect when the option is off", async () => {
    const { item } = mount();
    stub(item, rect(10, 220, 100, 200));
    await run({ clipStageToScrollParents: false });

    expect(hole().height).toBe(200);
  });

  it("draws a zero-size hole for an element scrolled fully out", async () => {
    const { item } = mount();
    stub(item, rect(10, 400, 100, 50));
    await run({});

    expect(hole()).toEqual({ width: 100, height: 0 });
  });

  it("lets a step override the config option in both directions", async () => {
    const { item } = mount();
    stub(item, rect(10, 220, 100, 200));
    const d = createDriver({
      animate: false,
      stagePadding: 0,
      stageRadius: 0,
      steps: [
        { element: "#item", clipStageToScrollParents: false, popover: { title: "raw" } },
        { element: "#item", popover: { title: "clipped" } },
      ],
    });
    d.drive();
    await nextFrame();
    expect(hole().height).toBe(200);

    d.moveNext();
    await nextFrame();
    expect(hole().height).toBe(80);

    d.destroy();
    const off = createDriver({
      animate: false,
      stagePadding: 0,
      stageRadius: 0,
      clipStageToScrollParents: false,
      steps: [{ element: "#item", clipStageToScrollParents: true, popover: { title: "clipped" } }],
    });
    off.drive();
    await nextFrame();
    expect(hole().height).toBe(80);
  });

  it("follows the compiled DimConfig.clipToScrollParents mapping", async () => {
    const { item } = mount();
    stub(item, rect(10, 220, 100, 200));

    for (const [dim, expected] of [
      [{ padding: 0, radius: 0 }, 80],
      [{ padding: 0, radius: 0, clipToScrollParents: false }, 200],
    ] as const) {
      const { base } = compileTour(normalizeTourConfig({ dim }), []);
      const d = createEngine({ ...base, animate: false } as Config);
      d.highlight({ element: "#item", popover: { title: "t" } });
      await nextFrame();
      expect(hole().height).toBe(expected);
      d.destroy();
    }
  });
});
