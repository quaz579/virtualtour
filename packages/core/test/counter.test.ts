import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { Tour, TourConfig } from "../src/index";
import { setCurrentTour } from "../src/registry";

const created: Tour[] = [];

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function show(config: TourConfig): Promise<Tour> {
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  await tour.start();
  return tour;
}

const progress = () => document.querySelector<HTMLElement>(".vt-popover-progress-text")!;

describe("counter", () => {
  it("is hidden by default", async () => {
    await show({ steps: [{ title: "A" }, { title: "B" }] });
    expect(progress().style.display).toBe("none");
  });

  it("true shows the position out of the step count", async () => {
    const tour = await show({ counter: true, steps: [{ title: "A" }, { title: "B" }, { title: "C" }] });
    expect(progress().textContent).toBe("1 of 3");
    expect(progress().style.display).not.toBe("none");
    await tour.forward();
    expect(progress().textContent).toBe("2 of 3");
  });

  it("a function receives the 1-based index and the step count", async () => {
    const counter = vi.fn((index: number, total: number) => `Step ${index}/${total}`);
    const tour = await show({ counter, steps: [{ title: "A" }, { title: "B" }] });
    expect(progress().textContent).toBe("Step 1/2");
    await tour.forward();
    expect(progress().textContent).toBe("Step 2/2");
    expect(counter).toHaveBeenCalledWith(2, 2);
  });

  it("counts skipped steps in the index and the total", async () => {
    const tour = await show({
      counter: true,
      steps: [{ title: "A" }, { title: "skipped", shouldShow: () => false }, { title: "C" }],
    });
    expect(progress().textContent).toBe("1 of 3");
    await tour.forward();
    expect(tour.currentStep?.id).toBe("step-3");
    expect(progress().textContent).toBe("3 of 3");
    expect(tour.progressInfo()).toEqual({ index: 3, total: 3 });
  });

  it("updates while shown after appendStep and dropStep", async () => {
    const tour = await show({ counter: true, steps: [{ title: "A" }, { title: "B" }] });
    expect(progress().textContent).toBe("1 of 2");
    tour.appendStep({ title: "C" });
    expect(progress().textContent).toBe("1 of 3");
    tour.appendStep({ title: "Z" }, 0);
    expect(progress().textContent).toBe("2 of 4");
    tour.dropStep("step-3");
    expect(progress().textContent).toBe("2 of 3");
  });

  it("a function counter also updates after appendStep while shown", async () => {
    const tour = await show({ counter: (i, n) => `${i}|${n}`, steps: [{ title: "A" }] });
    expect(progress().textContent).toBe("1|1");
    tour.appendStep({ title: "B" });
    expect(progress().textContent).toBe("1|2");
  });

  it("progressInfo is 0 of the step count before a run and while nothing is shown", async () => {
    const tour = createTour({ steps: [{}, {}] });
    expect(tour.progressInfo()).toEqual({ index: 0, total: 2 });
    created.push(tour);
    await tour.start();
    expect(tour.progressInfo()).toEqual({ index: 1, total: 2 });
    tour.hideCurrent();
    expect(tour.progressInfo()).toEqual({ index: 0, total: 2 });
  });
});
