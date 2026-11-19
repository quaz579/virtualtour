import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, useDriverHarness } from "./utils";
import { clipRectByScrollParents } from "../../src/engine/core/utils";

const dedupe = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../../src/engine/overlay/stage", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/engine/overlay/stage")>();

  return {
    ...actual,
    dedupeRects: (...args: Parameters<typeof actual.dedupeRects>) => {
      dedupe.calls += 1;

      return actual.dedupeRects(...args);
    },
  };
});

useDriverHarness();

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  dedupe.calls = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const rect = (x: number, y: number, width: number, height: number): DOMRect => new DOMRect(x, y, width, height);

describe("clipRectByScrollParents style reads", () => {
  it("reads each element in the chain once", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const item = document.createElement("div");
    outer.style.overflow = "auto";
    inner.style.overflow = "auto";
    inner.appendChild(item);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const spy = vi.spyOn(window, "getComputedStyle");
    clipRectByScrollParents(item, rect(0, 0, 10, 10));

    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe("extra cut-outs between refreshes", () => {
  async function start() {
    const extra = document.createElement("button");
    extra.id = "extra";
    document.body.appendChild(extra);
    const stubbed = vi.spyOn(extra, "getBoundingClientRect").mockReturnValue(rect(300, 10, 40, 20));
    const driver = createDriver({ animate: false, stagePadding: 0, stageRadius: 0 });
    driver.highlight({ element: "#intro", allowedElements: "#extra", popover: { title: "t" } });
    await nextFrame();
    await nextFrame();

    return { driver, stubbed };
  }

  it("does not recompute the path while the rects stay the same", async () => {
    const { driver } = await start();
    const before = dedupe.calls;
    expect(before).toBeGreaterThan(0);

    driver.refresh();
    await nextFrame();
    driver.refresh();
    await nextFrame();

    expect(dedupe.calls).toBe(before);
  });

  it("recomputes the path once an extra moves", async () => {
    const { driver, stubbed } = await start();
    const before = dedupe.calls;

    stubbed.mockReturnValue(rect(320, 10, 40, 20));
    driver.refresh();
    await nextFrame();

    expect(dedupe.calls).toBe(before + 1);
    expect(document.querySelector("[data-vt-overlay] path")!.getAttribute("d")).toContain("320");
  });

  it("recomputes the path when only an extra's height or the stage changes", async () => {
    const { driver, stubbed } = await start();
    const read = () => document.querySelector("[data-vt-overlay] path")!.getAttribute("d");
    const first = read();
    const before = dedupe.calls;

    stubbed.mockReturnValue(rect(300, 10, 40, 60));
    driver.refresh();
    await nextFrame();
    expect(dedupe.calls).toBe(before + 1);
    expect(read()).not.toBe(first);

    vi.spyOn(document.querySelector("#card-1")!, "getBoundingClientRect").mockReturnValue(rect(50, 50, 80, 30));
    driver.highlight({ element: "#card-1", allowedElements: "#extra", popover: { title: "t" } });
    await nextFrame();
    await nextFrame();
    expect(dedupe.calls).toBeGreaterThan(before + 1);
  });
});
