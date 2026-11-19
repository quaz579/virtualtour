import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, useDriverHarness } from "./utils";
import { bringInView } from "../../src/engine/core/utils";

useDriverHarness();

const scrollIntoView = vi.fn();

const farAway = (id: string, height = 20) => {
  const el = document.getElementById(id)!;
  el.getBoundingClientRect = () =>
    ({ x: 10, y: 5000, left: 10, top: 5000, width: 100, height, right: 110, bottom: 5000 + height, toJSON: () => ({}) }) as DOMRect;
  return el;
};

const reduceMotion = (reduce: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("prefers-reduced-motion: reduce") ? reduce : false, media: query }))
  );

beforeEach(() => {
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bringInView", () => {
  it("never scrolls for false, even for an element out of view", () => {
    bringInView(farAway("intro"), false, true);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("passes an options object through untouched", () => {
    const options = { block: "start", behavior: "smooth", inline: "nearest" } as const;
    bringInView(farAway("intro"), options);
    expect(scrollIntoView).toHaveBeenCalledWith(options);
  });

  it("keeps the in-view early return for an options object", () => {
    bringInView(document.getElementById("intro")!, { block: "start" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("calls with the upstream arguments by default", () => {
    bringInView(farAway("intro"));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", inline: "center", block: "center" });
  });

  it("starts a tall element at the top and glides when smoothScroll is on", () => {
    const tall = farAway("intro");
    Object.defineProperty(tall, "offsetHeight", { value: window.innerHeight + 10 });
    bringInView(tall, undefined, true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", inline: "center", block: "start" });
  });

  it("falls back to an instant scroll under reduced motion for the smoothScroll default", () => {
    reduceMotion(true);
    bringInView(farAway("intro"), undefined, true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", inline: "center", block: "center" });
  });

  it("falls back to an instant scroll under reduced motion for explicit smooth options", () => {
    reduceMotion(true);
    bringInView(farAway("intro"), { block: "start", behavior: "smooth" });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
  });

  it("forces an instant scroll under reduced motion when behavior is unset", () => {
    reduceMotion(true);
    bringInView(farAway("intro"), { block: "start" });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
  });

  it("keeps smooth scrolling when reduced motion is not requested", () => {
    reduceMotion(false);
    bringInView(farAway("intro"), { behavior: "smooth" });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });
});

describe("scrollIntoView step and config options", () => {
  it("scrolls a step with the step's options", () => {
    farAway("card-1");
    const d = createDriver({ animate: false });
    d.highlight({ element: "#card-1", scrollIntoView: { block: "start" }, popover: { title: "A" } });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0]![0]).toEqual({ block: "start" });
  });

  it("does not scroll the target or the popover when the step says false", () => {
    farAway("card-1");
    const d = createDriver({ animate: false });
    d.highlight({ element: "#card-1", scrollIntoView: false, popover: { title: "A" } });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not scroll an off-screen popover wrapper when the step says false", () => {
    const d = createDriver({ animate: false });
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return this.classList.contains("vt-popover-wrapper") || this.classList.contains("vt-popover") ? farAway("intro").getBoundingClientRect() : original.call(this);
    };
    try {
      d.highlight({ element: "#card-1", scrollIntoView: false, popover: { title: "A" } });
      expect(scrollIntoView).not.toHaveBeenCalled();
      scrollIntoView.mockClear();
      d.highlight({ element: "#card-1", popover: { title: "B" } });
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  it("uses Config.scrollIntoView when the step has none, and the step wins over it", () => {
    farAway("card-1");
    const d = createDriver({ animate: false, scrollIntoView: { block: "end" } });
    d.highlight({ element: "#card-1", popover: { title: "A" } });
    expect(scrollIntoView.mock.calls[0]![0]).toEqual({ block: "end" });

    scrollIntoView.mockClear();
    d.highlight({ element: "#card-1", scrollIntoView: false, popover: { title: "B" } });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("honors Config.scrollIntoView false", () => {
    farAway("card-1");
    const d = createDriver({ animate: false, scrollIntoView: false });
    d.highlight({ element: "#card-1", popover: { title: "A" } });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps the engine default for a step without options", () => {
    farAway("card-1");
    const d = createDriver({ animate: false });
    d.highlight({ element: "#card-1", popover: { title: "A" } });
    expect(scrollIntoView.mock.calls[0]![0]).toEqual({ behavior: "auto", inline: "center", block: "center" });
  });

  it("downgrades smoothScroll to an instant scroll under reduced motion", () => {
    reduceMotion(true);
    farAway("card-1");
    const d = createDriver({ animate: false, smoothScroll: true });
    d.highlight({ element: "#card-1", popover: { title: "A" } });
    expect(scrollIntoView.mock.calls[0]![0].behavior).toBe("instant");
  });
});
