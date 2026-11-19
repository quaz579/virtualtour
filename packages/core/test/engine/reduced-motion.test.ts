import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";
import { prefersReducedMotion } from "../../src/engine/core/env";

useDriverHarness();

let reduce = false;

const stubMatchMedia = (initial: boolean) => {
  reduce = initial;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce") ? reduce : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
};

const mockRect = (id: string, top: number) => {
  const el = document.getElementById(id)!;
  el.getBoundingClientRect = () =>
    ({ x: 10, y: top, left: 10, top, width: 100, height: 20, right: 110, bottom: top + 20, toJSON: () => ({}) }) as DOMRect;
};

const frames = async (count: number) => {
  for (let i = 0; i < count; i += 1) {
    await nextFrame();
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("is false without matchMedia and follows the media query otherwise", () => {
    expect(prefersReducedMotion()).toBe(false);
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    reduce = false;
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("reduced motion in the engine", () => {
  it("settles the stage on the target on the first frame and renders the popover at once", async () => {
    stubMatchMedia(true);
    mockRect("intro", 10);
    mockRect("card-1", 200);
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: true, duration: 5000, stagePadding: 0, onHighlighted, steps: SAMPLE_STEPS });
    d.drive();
    await frames(2);
    onHighlighted.mockClear();

    d.moveNext();
    expect(popoverTitle()).toBe("Step 2");
    await frames(2);

    expect(onHighlighted).toHaveBeenCalledTimes(1);
    expect(d.getState("__activeStagePosition")).toMatchObject({ x: 10, y: 200, width: 100, height: 20 });
  });

  it("uses the simple class and no fade attribute on the body", () => {
    stubMatchMedia(true);
    const d = createDriver({ animate: true, steps: SAMPLE_STEPS });
    d.drive();

    expect(document.body.classList.contains("vt-simple")).toBe(true);
    expect(document.body.classList.contains("vt-fade")).toBe(false);
    expect(document.body.hasAttribute("data-vt-fade")).toBe(false);
  });

  it("keeps the fade class and the tween when motion is allowed", async () => {
    stubMatchMedia(false);
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: true, duration: 5000, onHighlighted, steps: SAMPLE_STEPS });
    d.drive();
    await frames(2);
    onHighlighted.mockClear();

    expect(document.body.classList.contains("vt-fade")).toBe(true);
    expect(document.body.hasAttribute("data-vt-fade")).toBe(true);

    d.moveNext();
    await frames(3);
    expect(onHighlighted).not.toHaveBeenCalled();
  });

  it("picks up an OS preference change on the next step", async () => {
    stubMatchMedia(false);
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: true, duration: 5000, onHighlighted, steps: SAMPLE_STEPS });
    d.drive();
    await frames(2);
    onHighlighted.mockClear();

    reduce = true;
    d.moveNext();
    await frames(2);
    expect(onHighlighted).toHaveBeenCalledTimes(1);
  });

  it("keeps animate: false behavior unchanged", () => {
    stubMatchMedia(false);
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    expect(document.body.classList.contains("vt-simple")).toBe(true);
  });
});
