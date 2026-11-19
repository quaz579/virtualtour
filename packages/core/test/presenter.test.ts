import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour } from "../src/index";
import { DialogPresenter } from "../src/presenter";
import type { PopoverDOM } from "../src/engine/popover/popover";

function fakePopover(): PopoverDOM {
  return { wrapper: document.createElement("div") } as unknown as PopoverDOM;
}

describe("DialogPresenter", () => {
  it("adds vt-dialog and the step index attribute on mount", () => {
    const tour = createTour({ steps: [{}, {}, {}] });
    const presenter = new DialogPresenter(tour, "vt");
    const popover = fakePopover();
    presenter.mount(popover, tour.steps[2]!, { buttons: [] });
    expect(popover.wrapper.classList.contains("vt-dialog")).toBe(true);
    expect(popover.wrapper.getAttribute("data-vt-step")).toBe("2");
  });

  it("uses the tour's namespace for the attribute", () => {
    const tour = createTour({ namespace: "acme", steps: [{}, {}] });
    const presenter = new DialogPresenter(tour, "acme");
    const popover = fakePopover();
    presenter.mount(popover, tour.steps[1]!, { buttons: [] });
    expect(popover.wrapper.getAttribute("data-acme-step")).toBe("1");
    expect(popover.wrapper.hasAttribute("data-vt-step")).toBe(false);
  });

  it("is a dialog layout and its other hooks are safe no-ops", () => {
    const tour = createTour({ steps: [{}] });
    const presenter = new DialogPresenter(tour, "vt");
    const popover = fakePopover();
    const step = tour.steps[0]!;
    expect(presenter.layout).toBe("dialog");
    expect(() => {
      presenter.afterShow(popover, step);
      presenter.afterReposition(popover, step, {
        side: "bottom",
        align: "center",
        physicalAlign: "center",
        rtl: false,
        pinned: false,
        wrapperRect: new DOMRect(),
        bubbleRect: new DOMRect(),
        targetRect: null,
      });
      presenter.update(popover, step, { buttons: [] });
      presenter.beforeLeave(step);
      presenter.unmount();
    }).not.toThrow();
  });
});

describe("Presenter.ready bound", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function neverReady(): (tour: ReturnType<typeof createTour>) => DialogPresenter {
    return (tour) => Object.assign(new DialogPresenter(tour, "vt"), { ready: () => new Promise<void>(() => {}) });
  }

  it("shows the first step once a ready that never settles passes 10 seconds, and warns", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = createTour({ animate: false, steps: [{ id: "a", title: "A" }], presenter: neverReady() });
    const started = tour.start();
    await vi.advanceTimersByTimeAsync(9999);
    expect(document.querySelector(".vt-popover")).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await started;
    expect(document.querySelector(".vt-popover")).not.toBeNull();
    expect(warn.mock.calls.some((call) => String(call[0]).includes("presenter.ready did not settle"))).toBe(true);
    tour.finish();
  });

  it("does not warn when the run ended while ready was pending", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = createTour({ animate: false, steps: [{ id: "a", title: "A" }], presenter: neverReady() });
    void tour.start();
    await vi.advanceTimersByTimeAsync(0);
    await tour.exit();
    await vi.advanceTimersByTimeAsync(20000);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector(".vt-popover")).toBeNull();
  });
});
