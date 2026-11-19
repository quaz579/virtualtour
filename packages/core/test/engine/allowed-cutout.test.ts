import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, useDriverHarness } from "./utils";
import { dedupeRects } from "../../src/engine/overlay/stage";

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

function add(id: string, box: DOMRect, parent: Element = document.body): HTMLElement {
  const element = document.createElement("div");
  element.id = id;
  parent.appendChild(element);
  stub(element, box);
  return element;
}

const subpaths = () => document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!.split("M").length - 1;

async function run(allowedElements: string, config: Record<string, unknown> = {}) {
  const driver = createDriver({ animate: false, stagePadding: 0, stageRadius: 0, ...config });
  driver.highlight({ element: "#intro", allowedElements, popover: { title: "t" } });
  await nextFrame();
  await nextFrame();
  return driver;
}

describe("dedupeRects", () => {
  const stage = rect(100, 100, 100, 100);

  it("keeps disjoint rects", () => {
    expect(dedupeRects(stage, [rect(0, 0, 10, 10), rect(300, 0, 10, 10)])).toHaveLength(2);
  });

  it("drops a rect fully inside the stage", () => {
    expect(dedupeRects(stage, [rect(120, 120, 10, 10)])).toEqual([]);
  });

  it("drops a rect inside another kept rect, whatever the order", () => {
    expect(dedupeRects(stage, [rect(5, 5, 10, 10), rect(0, 0, 50, 50)])).toEqual([rect(0, 0, 50, 50)]);
  });

  it("keeps one of two identical rects", () => {
    expect(dedupeRects(stage, [rect(0, 0, 10, 10), rect(0, 0, 10, 10)])).toHaveLength(1);
  });

  it("keeps a rect that only overlaps the stage", () => {
    expect(dedupeRects(stage, [rect(150, 150, 100, 100)])).toHaveLength(1);
  });
});

describe("allowed element cut-outs outside a dialog", () => {
  beforeEach(() => {
    stub(document.querySelector("#intro")!, rect(100, 100, 100, 100));
  });

  it("adds one sub-path per allowed element", async () => {
    add("a", rect(300, 10, 50, 30)).className = "extra";
    add("b", rect(300, 200, 50, 30)).className = "extra";
    await run(".extra");

    expect(subpaths()).toBe(4);
  });

  it("adds no sub-path for an allowed element inside the active element", async () => {
    add("a", rect(120, 120, 20, 20)).className = "extra";
    await run(".extra");

    expect(subpaths()).toBe(2);
  });

  it("adds no sub-path for an allowed element nested in another", async () => {
    const outer = add("outer", rect(300, 300, 100, 100));
    outer.className = "extra";
    add("inner", rect(310, 310, 20, 20), outer).className = "extra";
    await run(".extra");

    expect(subpaths()).toBe(3);
  });

  it("clips an allowed element partly scrolled out of a scroller", async () => {
    const scroller = add("scroller", rect(300, 300, 100, 100));
    scroller.style.overflow = "auto";
    add("a", rect(310, 360, 40, 60), scroller).className = "extra";
    await run(".extra");

    const d = document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!;
    expect(d).toContain("M310,360h40v40h-40z");
  });

  it("keeps the raw rect when clipping is off", async () => {
    const scroller = add("scroller", rect(300, 300, 100, 100));
    scroller.style.overflow = "auto";
    add("a", rect(310, 360, 40, 60), scroller).className = "extra";
    await run(".extra", { clipStageToScrollParents: false });

    const d = document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!;
    expect(d).toContain("M310,360h40v60h-40z");
  });

  it("skips an allowed element with no size", async () => {
    add("a", rect(0, 0, 0, 0)).className = "extra";
    await run(".extra");

    expect(subpaths()).toBe(2);
  });

  it("cuts out an allowed element added after the step started", async () => {
    await run(".extra");
    expect(subpaths()).toBe(2);

    add("late", rect(300, 10, 50, 30)).className = "extra";
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(subpaths()).toBe(3);
  });
});
