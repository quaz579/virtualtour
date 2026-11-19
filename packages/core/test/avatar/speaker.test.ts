import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour } from "../../src/index";
import type { PopoverDOM } from "../../src/engine/popover/popover";
import { SpeakerPresenter } from "../../src/avatar/speaker";
import type { SpeakerPresenterOptions } from "../../src/avatar/speaker";
import { normalizePack, validatePack } from "../../src/avatar/pack";
import type { AvatarPack } from "../../src/avatar/pack";
import { setCurrentTour } from "../../src/registry";
import type { Presenter, RepositionInfo, StepConfig, TourConfig } from "../../src/types";

const definition: AvatarPack = {
  format: "virtualtour-avatar/1",
  name: "unit",
  sheet: { src: "sheet.png", frameWidth: 32, frameHeight: 24, columns: 4 },
  animations: { rest: { frames: [{ col: 0, row: 0, ms: 500 }], loop: true } },
  roles: { rest: "rest" },
};

const pack = (extra: Partial<AvatarPack> = {}) => normalizePack(validatePack({ ...definition, ...extra }), "http://localhost/");

let wrapperRect: DOMRect;
let bubbleRect: DOMRect;
let targetRect: DOMRect;
const created: Tour[] = [];

beforeEach(() => {
  wrapperRect = new DOMRect(0, 0, 200, 100);
  bubbleRect = new DOMRect(0, 0, 150, 100);
  targetRect = new DOMRect(400, 300, 100, 30);
  const target = document.createElement("button");
  target.id = "target";
  document.body.append(target);
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.classList.contains("vt-bubble")) return bubbleRect;
    if (this.classList.contains("vt-popover")) return wrapperRect;
    if (this.id === "target") return targetRect;
    return new DOMRect();
  });
});

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const steps = (...configs: StepConfig[]): StepConfig[] => configs;
const bottom: StepConfig = { id: "a", title: "First", body: "One", target: "#target", placement: { side: "bottom" } };

function make(stepConfigs: StepConfig[], options: SpeakerPresenterOptions = {}, extra: TourConfig = {}, avatarPack = pack()): { tour: Tour; presenter: () => SpeakerPresenter } {
  let current: SpeakerPresenter | undefined;
  const tour = createTour({
    animate: false,
    steps: stepConfigs,
    presenter: (t) => (current = new SpeakerPresenter(t, avatarPack, options)),
    ...extra,
  });
  created.push(tour);
  return { tour, presenter: () => current as SpeakerPresenter };
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover") as HTMLElement;
const slot = () => document.querySelector<HTMLElement>(".vt-avatar-slot") as HTMLElement;

describe("SpeakerPresenter structure", () => {
  it("builds a dialog named by the step title with a decorative, non-focusable avatar", async () => {
    const { tour } = make(steps(bottom));
    await tour.start();
    const dialog = wrapper();
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.classList.contains("vt-speaker")).toBe(true);
    expect(dialog.classList.contains("vt-dialog")).toBe(true);
    const labelledBy = dialog.getAttribute("aria-labelledby") as string;
    expect(document.getElementById(labelledBy)?.textContent).toBe("First");
    const avatar = slot().querySelector<HTMLElement>(".vt-avatar") as HTMLElement;
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.hasAttribute("tabindex")).toBe(false);
    expect(avatar.querySelector("button, a, input, [tabindex]")).toBeNull();
    expect(dialog.querySelector(".vt-bubble .vt-popover-title")).not.toBeNull();
    expect(dialog.querySelector(":scope > .vt-popover-arrow.vt-bubble-tail")).not.toBeNull();
  });

  it("keeps custom buttons and the instruction row inside the bubble", async () => {
    const { tour } = make(
      steps({ id: "a", title: "A", body: "x", instruction: "Do it", buttons: [{ text: "Go", action: "forward" }] }),
    );
    await tour.start();
    expect(wrapper().querySelector(".vt-bubble .vt-footer .vt-button")).not.toBeNull();
    expect(wrapper().querySelector(".vt-bubble .vt-popover-instruction")).not.toBeNull();
    expect(slot().children).toHaveLength(1);
  });

  it("moves the same avatar element into the next step's slot", async () => {
    const { tour, presenter } = make(steps(bottom, { id: "b", title: "Second", body: "Two" }));
    await tour.start();
    const first = slot().firstElementChild;
    expect(first).toBe(presenter().avatar);
    await tour.forward();
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
    expect(slot().firstElementChild).toBe(first);
    expect(first?.isConnected).toBe(true);
  });

  it("renders no avatar for a hidden step and brings it back on the next", async () => {
    const { tour, presenter } = make(steps({ ...bottom, extensions: { avatar: { hidden: true } } }, { id: "b", title: "B", body: "b" }));
    await tour.start();
    expect(wrapper().classList.contains("vt-speaker--no-avatar")).toBe(true);
    expect(slot().children).toHaveLength(0);
    expect(presenter().avatar.isConnected).toBe(false);
    await tour.forward();
    expect(wrapper().classList.contains("vt-speaker--no-avatar")).toBe(false);
    expect(slot().firstElementChild).toBe(presenter().avatar);
  });

  it("removes the avatar when the tour ends", async () => {
    const { tour, presenter } = make(steps(bottom));
    await tour.start();
    expect(presenter().avatar.isConnected).toBe(true);
    tour.finish();
    expect(presenter().avatar.isConnected).toBe(false);
  });

  it("sizes the slot from the frame and scale and scales the avatar from its corner", async () => {
    const { tour, presenter } = make(steps(bottom), { scale: 3 });
    await tour.start();
    expect(slot().style.width).toBe("96px");
    expect(slot().style.height).toBe("72px");
    expect(presenter().avatar.style.transform).toBe("scale(3)");
    expect(presenter().avatar.style.transformOrigin).toBe("0px 0px");
  });

  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])("ignores the unusable scale %s", async (scale) => {
    const { tour, presenter } = make(steps(bottom), { scale });
    await tour.start();
    expect(slot().style.width).toBe("32px");
    expect(presenter().avatar.style.transform).toBe("");
  });

  it("passes the pack's bubble gap to the stylesheet", async () => {
    const { tour } = make(steps(bottom), {}, {}, pack({ bubble: { gap: 14 } }));
    await tour.start();
    expect(wrapper().style.getPropertyValue("--vt-avatar-gap")).toBe("14px");
  });
});

describe("SpeakerPresenter dock", () => {
  const dockOf = () => wrapper().getAttribute("data-vt-dock");

  it("defaults to end", async () => {
    const { tour } = make(steps(bottom));
    await tour.start();
    expect(dockOf()).toBe("end");
  });

  it("takes the pack hint, then the tour option, then the step extension", async () => {
    const hinted = make(steps(bottom), {}, {}, pack({ bubble: { dock: "start" } }));
    await hinted.tour.start();
    expect(dockOf()).toBe("start");
    hinted.tour.finish();

    const optioned = make(steps(bottom), { dock: "end" }, {}, pack({ bubble: { dock: "start" } }));
    await optioned.tour.start();
    expect(dockOf()).toBe("end");
    optioned.tour.finish();

    const stepped = make(steps({ ...bottom, extensions: { avatar: { dock: "start" } } }), { dock: "end" });
    await stepped.tour.start();
    expect(dockOf()).toBe("start");
  });

  it("ignores a malformed step extension", async () => {
    const { tour } = make(steps({ ...bottom, extensions: { avatar: { dock: "sideways", hidden: "yes" } } }), { dock: "start" });
    await tour.start();
    expect(dockOf()).toBe("start");
    expect(wrapper().classList.contains("vt-speaker--no-avatar")).toBe(false);
  });

  it("auto docks on the side of the target with more room and refreshes once", async () => {
    targetRect = new DOMRect(900, 300, 60, 30);
    const { tour } = make(steps(bottom), { dock: "auto" });
    const refresh = vi.spyOn(tour, "refresh");
    await tour.start();
    await Promise.resolve();
    expect(dockOf()).toBe("start");
    expect(refresh).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("auto docks at the end when the right has more room, without a refresh", async () => {
    targetRect = new DOMRect(100, 300, 60, 30);
    const { tour } = make(steps(bottom), { dock: "auto" });
    const refresh = vi.spyOn(tour, "refresh");
    await tour.start();
    await Promise.resolve();
    expect(dockOf()).toBe("end");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("auto mirrors for a right-to-left target", async () => {
    targetRect = new DOMRect(100, 300, 60, 30);
    const { tour } = make(steps(bottom), { dock: "auto" });
    (document.getElementById("target") as HTMLElement).style.direction = "rtl";
    await tour.start();
    expect(dockOf()).toBe("start");
  });

  it("auto puts the avatar above the bubble beside a left or right side only when the bubble would then lose the target", async () => {
    const step: StepConfig = { id: "a", title: "A", body: "x", target: "#target", placement: { side: "right" } };
    wrapperRect = new DOMRect(200, 0, 200, 200);
    bubbleRect = new DOMRect(200, 0, 200, 100);
    targetRect = new DOMRect(100, 100, 60, 30);
    const roomy = make(steps(step), { dock: "auto" });
    await roomy.tour.start();
    expect(dockOf()).toBe("end");
    roomy.tour.finish();

    targetRect = new DOMRect(100, 700, 60, 30);
    const cramped = make(steps(step), { dock: "auto" });
    await cramped.tour.start();
    expect(dockOf()).toBe("start");
  });

  it("never refreshes more than twice for one step however the layout flips", async () => {
    const tour = createTour({ animate: false, steps: steps(bottom, { id: "b", title: "B", body: "b" }) });
    created.push(tour);
    const refresh = vi.spyOn(tour, "refresh").mockImplementation(() => undefined);
    const presenter = new SpeakerPresenter(tour, pack(), { dock: "auto" });
    const popover = fakePopover();
    const step = tour.steps[0] as (typeof tour.steps)[number];
    presenter.mount(popover, step, { buttons: [] });
    const far = (left: number): RepositionInfo => info({ side: "bottom", targetRect: new DOMRect(left, 300, 60, 30) });
    for (const left of [900, 100, 900, 100, 900]) {
      presenter.afterReposition(popover, step, far(left));
      await Promise.resolve();
    }
    expect(refresh).toHaveBeenCalledTimes(2);

    const next = tour.steps[1] as (typeof tour.steps)[number];
    presenter.beforeLeave(step);
    presenter.mount(popover, next, { buttons: [] });
    presenter.afterReposition(popover, next, far(900));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("spends no budget once the layout has settled, so a later flip is re-measured", async () => {
    const tour = createTour({ animate: false, steps: steps(bottom) });
    created.push(tour);
    const refresh = vi.spyOn(tour, "refresh").mockImplementation(() => undefined);
    const presenter = new SpeakerPresenter(tour, pack(), { dock: "auto" });
    const popover = fakePopover();
    const step = tour.steps[0] as (typeof tour.steps)[number];
    presenter.mount(popover, step, { buttons: [] });
    const at = (left: number) => info({ side: "bottom", targetRect: new DOMRect(left, 300, 60, 30) });
    for (const left of [900, 100, 100, 900, 900, 100]) {
      presenter.afterReposition(popover, step, at(left));
      await Promise.resolve();
    }
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("keeps the avatar below when neither above nor below has room", async () => {
    const tour = createTour({ animate: false, steps: steps(bottom) });
    created.push(tour);
    const presenter = new SpeakerPresenter(tour, pack(), { dock: "auto" });
    const popover = fakePopover();
    const step = tour.steps[0] as (typeof tour.steps)[number];
    presenter.mount(popover, step, { buttons: [] });
    presenter.afterReposition(
      popover,
      step,
      info({ side: "right", targetRect: new DOMRect(10, 380, 60, 30), wrapperRect: new DOMRect(0, 0, 200, 900), bubbleRect: new DOMRect(0, 0, 200, 300) }),
    );
    expect(popover.wrapper.getAttribute("data-vt-dock")).toBe("end");
  });

  it("does not refresh a step that has already been left", async () => {
    const tour = createTour({ animate: false, steps: steps(bottom) });
    created.push(tour);
    const refresh = vi.spyOn(tour, "refresh").mockImplementation(() => undefined);
    const presenter = new SpeakerPresenter(tour, pack(), { dock: "auto" });
    const popover = fakePopover();
    const step = tour.steps[0] as (typeof tour.steps)[number];
    presenter.mount(popover, step, { buttons: [] });
    presenter.afterReposition(popover, step, info({ side: "bottom", targetRect: new DOMRect(900, 300, 60, 30) }));
    presenter.beforeLeave(step);
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });
});

function fakePopover(): PopoverDOM {
  const wrapper = document.createElement("div");
  document.body.append(wrapper);
  const avatarSlot = document.createElement("div");
  wrapper.append(avatarSlot);
  return { wrapper, avatarSlot } as unknown as PopoverDOM;
}

function info(partial: Partial<RepositionInfo>): RepositionInfo {
  return {
    side: "bottom",
    align: "center",
    physicalAlign: "center",
    rtl: false,
    pinned: false,
    wrapperRect: new DOMRect(0, 0, 200, 100),
    bubbleRect: new DOMRect(0, 0, 150, 100),
    targetRect: null,
    ...partial,
  };
}

describe("SpeakerPresenter side", () => {
  const sideOf = () => wrapper().getAttribute("data-vt-side");

  it("starts from the requested side and follows the engine's final side", async () => {
    const { tour } = make(steps({ ...bottom, placement: { side: "top" } }));
    await tour.start();
    expect(sideOf()).toBe("top");
  });

  it("treats a centered step as over", async () => {
    const { tour } = make(steps({ id: "a", title: "A", body: "x" }));
    await tour.start();
    expect(sideOf()).toBe("over");
  });

  it("writes over, not the requested side, when the engine pinned the popover", async () => {
    wrapperRect = new DOMRect(0, 0, 3000, 3000);
    bubbleRect = new DOMRect(0, 0, 2900, 3000);
    const { tour } = make(steps(bottom));
    await tour.start();
    expect(sideOf()).toBe("over");
  });

  it("writes the namespaced side attribute too, with the same corrections", async () => {
    wrapperRect = new DOMRect(0, 0, 3000, 3000);
    bubbleRect = new DOMRect(0, 0, 2900, 3000);
    const { tour } = make(steps(bottom), { namespace: "acme" }, { namespace: "acme" });
    await tour.start();
    expect(wrapper().getAttribute("data-acme-side")).toBe("over");
    expect(wrapper().getAttribute("data-vt-side")).toBe("over");
  });

  it("keeps the shipped hook independent of the namespace on an ordinary step", async () => {
    const { tour } = make(steps(bottom), { namespace: "acme" }, { namespace: "acme" });
    await tour.start();
    expect(wrapper().getAttribute("data-acme-side")).toBe("bottom");
    expect(wrapper().getAttribute("data-vt-side")).toBe("bottom");
  });
});

describe("RepositionInfo as the tour forwards it", () => {
  function spy(): { presenter: Presenter; infos: RepositionInfo[] } {
    const infos: RepositionInfo[] = [];
    const presenter: Presenter = {
      mount: () => undefined,
      afterShow: () => undefined,
      afterReposition: (_p, _s, info) => infos.push(info),
      update: () => undefined,
      beforeLeave: () => undefined,
      unmount: () => undefined,
    };
    return { presenter, infos };
  }

  it("reports pinned when no side fits and not otherwise", async () => {
    const { presenter, infos } = spy();
    const fits = createTour({ animate: false, steps: steps(bottom), presenter: () => presenter });
    created.push(fits);
    await fits.start();
    expect(infos.at(-1)?.pinned).toBe(false);
    fits.finish();

    wrapperRect = new DOMRect(0, 0, 3000, 3000);
    const cramped = createTour({ animate: false, steps: steps(bottom), presenter: () => presenter });
    created.push(cramped);
    await cramped.start();
    expect(infos.at(-1)?.pinned).toBe(true);
  });

  it("reports the physical alignment and direction, mirrored for right-to-left anchors", async () => {
    const { presenter, infos } = spy();
    const aligned: StepConfig = { ...bottom, placement: { side: "bottom", align: "start" } };
    const ltr = createTour({ animate: false, steps: steps(aligned), presenter: () => presenter });
    created.push(ltr);
    await ltr.start();
    expect(infos.at(-1)).toMatchObject({ rtl: false, physicalAlign: "left", align: "start" });
    ltr.finish();

    (document.getElementById("target") as HTMLElement).style.direction = "rtl";
    const rtl = createTour({ animate: false, steps: steps(aligned), presenter: () => presenter });
    created.push(rtl);
    await rtl.start();
    expect(infos.at(-1)).toMatchObject({ rtl: true, physicalAlign: "right", align: "start" });
  });

  it("reports the side alignment as top or bottom", async () => {
    const { presenter, infos } = spy();
    const tour = createTour({
      animate: false,
      steps: steps({ ...bottom, placement: { side: "right", align: "end" } }),
      presenter: () => presenter,
    });
    created.push(tour);
    await tour.start();
    expect(infos.at(-1)).toMatchObject({ physicalAlign: "bottom" });
  });
});
