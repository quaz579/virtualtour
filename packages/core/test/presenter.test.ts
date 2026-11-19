import { describe, expect, it } from "vitest";
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
