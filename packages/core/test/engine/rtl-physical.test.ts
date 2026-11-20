import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DriveStep, RepositionInfo } from "../../src/engine/driver";
import { repositionPopover, type PositionOptions } from "../../src/engine/popover/position";
import type { PopoverDOM } from "../../src/engine/popover/popover";
import { createDriver, popoverEl, tick, useDriverHarness } from "./utils";

useDriverHarness();

const POPOVER = { width: 200, height: 100 };
const W = window.innerWidth;
const H = window.innerHeight;

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

type Dir = "ltr" | "rtl";
type Side = "top" | "bottom" | "left" | "right" | "over" | "auto";
type Align = "start" | "center" | "end";
type Setup = { side?: Side; align?: Align; flip?: boolean; shift?: boolean; anchorDir?: Dir; mountDir?: Dir };

const TARGET = rect(400, 300, 100, 40);

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  document.body.innerHTML = `<div id="host"><button id="target" type="button">T</button></div>`;
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
  vi.restoreAllMocks();
  document.documentElement.style.direction = "";
});

function show(dir: Dir, targetRect: DOMRect, { side = "top", align = "start", flip, shift, anchorDir, mountDir }: Setup = {}) {
  document.documentElement.style.direction = dir;
  if (anchorDir) document.getElementById("host")!.style.direction = anchorDir;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "target") return targetRect;
    if (this.classList.contains("vt-popover")) {
      const style = (this as HTMLElement).style;
      const left = style.left === "auto" ? W - parseFloat(style.right) - POPOVER.width : parseFloat(style.left) || 0;
      const top = style.top === "auto" ? H - parseFloat(style.bottom) - POPOVER.height : parseFloat(style.top) || 0;
      return rect(left, top, POPOVER.width, POPOVER.height);
    }
    return rect(0, 0, 10, 10);
  });
  const infos: RepositionInfo[] = [];
  let mountIn: HTMLElement | undefined;
  if (mountDir) {
    mountIn = document.createElement("div");
    mountIn.style.direction = mountDir;
    document.body.appendChild(mountIn);
  }
  const driver = createDriver({
    animate: false,
    stagePadding: 0,
    popoverOffset: 0,
    ...(mountIn ? { mountIn: () => mountIn! } : {}),
    onReposition: info => infos.push(info),
    steps: [
      {
        element: "#target",
        popover: { title: "T", side, align, ...(flip === undefined ? {} : { flip }), ...(shift === undefined ? {} : { shift }) },
      },
    ],
  });
  driver.drive();
  const wrapper = popoverEl()!;
  const info = infos.at(-1)!;

  return { wrapper, info, popRect: info.wrapperRect };
}

const SIDES = ["top", "bottom", "left", "right"] as const;
const ALIGNS = ["start", "center", "end"] as const;

describe("physicalAlign reports the edge the popover actually lines up with", () => {
  for (const dir of ["ltr", "rtl"] as const) {
    for (const side of SIDES) {
      for (const align of ALIGNS) {
        it(`${dir} ${side} ${align}`, () => {
          const { info, popRect: pop } = show(dir, TARGET, { side, align });
          expect(info.side).toBe(side);
          expect(info.align).toBe(align);
          expect(info.rtl).toBe(dir === "rtl");
          expect(info.pinned).toBe(false);
          const t = TARGET;
          switch (info.physicalAlign) {
            case "left":
              expect(pop.left).toBe(t.left);
              break;
            case "right":
              expect(pop.right).toBe(t.right);
              break;
            case "top":
              expect(pop.top).toBe(t.top);
              break;
            case "bottom":
              expect(pop.bottom).toBe(t.bottom);
              break;
            case "center":
              if (side === "top" || side === "bottom") {
                expect(pop.left + pop.width / 2).toBe(t.left + t.width / 2);
              } else {
                expect(pop.top + pop.height / 2).toBe(t.top + t.height / 2);
              }
          }
          const expected =
            align === "center"
              ? "center"
              : side === "left" || side === "right"
                ? align === "start"
                  ? "top"
                  : "bottom"
                : (align === "start") === (dir === "ltr")
                  ? "left"
                  : "right";
          expect(info.physicalAlign).toBe(expected);
        });
      }
    }
  }
});

describe("centered and pinned popovers", () => {
  for (const dir of ["ltr", "rtl"] as const) {
    it(`${dir} over reports center and not pinned`, () => {
      const { info } = show(dir, TARGET, { side: "over", align: "start" });
      expect(info.side).toBe("over");
      expect(info.physicalAlign).toBe("center");
      expect(info.pinned).toBe(false);
    });

    it(`${dir} pinned reports center, pinned and the requested side`, () => {
      const huge = rect(10, 10, W - 20, H - 20);
      const { info, popRect } = show(dir, huge, { side: "top", align: "start" });
      expect(info.pinned).toBe(true);
      expect(info.side).toBe("top");
      expect(info.physicalAlign).toBe("center");
      expect(info.rtl).toBe(dir === "rtl");
      expect(popRect.left + popRect.width / 2).toBe(W / 2);
      expect(popRect.bottom).toBeGreaterThan(H - 30);
    });
  }
});

describe("alignment flip is logical", () => {
  it("ltr start flips to end and reports right", () => {
    const { info, popRect } = show("ltr", rect(W - 110, 300, 100, 40), { side: "bottom", align: "start" });
    expect(info.align).toBe("end");
    expect(info.physicalAlign).toBe("right");
    expect(popRect.right).toBe(W - 10);
  });

  it("rtl start flips to end and reports left", () => {
    const { info, popRect } = show("rtl", rect(10, 300, 100, 40), { side: "bottom", align: "start" });
    expect(info.align).toBe("end");
    expect(info.physicalAlign).toBe("left");
    expect(popRect.left).toBe(10);
  });

  it("rtl end flips to start and reports right", () => {
    const { info } = show("rtl", rect(W - 110, 300, 100, 40), { side: "bottom", align: "end" });
    expect(info.align).toBe("start");
    expect(info.physicalAlign).toBe("right");
  });

  it("keeps the alignment when flip is off", () => {
    const { info } = show("rtl", rect(10, 300, 100, 40), { side: "bottom", align: "start", flip: false, shift: false });
    expect(info.align).toBe("start");
    expect(info.physicalAlign).toBe("right");
  });

  it("left and right sides flip vertically without mirroring", () => {
    for (const dir of ["ltr", "rtl"] as const) {
      const { info } = show(dir, rect(400, H - 50, 100, 40), { side: "right", align: "start" });
      expect(info.align).toBe("end");
      expect(info.physicalAlign).toBe("bottom");
      document.body.innerHTML = `<div id="host"><button id="target" type="button">T</button></div>`;
      vi.restoreAllMocks();
    }
  });
});

describe("side fallback in right-to-left", () => {
  it("a flipped side keeps physicalAlign for the new side", () => {
    const { info } = show("rtl", rect(400, 10, 100, 40), { side: "top", align: "start" });
    expect(info.side).toBe("right");
    expect(info.physicalAlign).toBe("top");
    expect(info.pinned).toBe(false);
  });
});

describe("direction source", () => {
  it("a left-to-right anchor in a right-to-left mount keeps the popover left to right", () => {
    const { info, popRect, wrapper } = show("ltr", TARGET, { side: "bottom", align: "start", mountDir: "rtl" });
    expect(info.rtl).toBe(false);
    expect(info.physicalAlign).toBe("left");
    expect(popRect.left).toBe(400);
    expect(wrapper.getAttribute("dir")).toBe("ltr");
    expect(wrapper.classList.contains("vt-popover-rtl")).toBe(false);
  });

  it("a right-to-left anchor in a left-to-right mount makes the popover right to left", () => {
    const { info, popRect, wrapper } = show("ltr", TARGET, { side: "bottom", align: "start", anchorDir: "rtl" });
    expect(info.rtl).toBe(true);
    expect(info.physicalAlign).toBe("right");
    expect(popRect.right).toBe(500);
    expect(wrapper.getAttribute("dir")).toBe("rtl");
    expect(wrapper.classList.contains("vt-popover-rtl")).toBe(true);
  });

  it("leaves dir alone when anchor and wrapper agree", () => {
    expect(show("rtl", TARGET).wrapper.hasAttribute("dir")).toBe(false);
  });
  function twoStepRun(steps: DriveStep[], mountDir?: Dir) {
    document.documentElement.style.direction = "ltr";
    document.body.insertAdjacentHTML("beforeend", `<div id="rtl-host" style="direction:rtl"><button id="rtl-target" type="button">R</button></div>`);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.id === "target" || this.id === "rtl-target") return TARGET;
      if (this.classList.contains("vt-popover")) return rect(0, 0, POPOVER.width, POPOVER.height);
      return rect(0, 0, 10, 10);
    });
    let mountIn: HTMLElement | undefined;
    if (mountDir) {
      mountIn = document.createElement("div");
      mountIn.style.direction = mountDir;
      document.body.appendChild(mountIn);
    }
    const driver = createDriver({
      animate: false,
      stagePadding: 0,
      popoverOffset: 0,
      ...(mountIn ? { mountIn: () => mountIn! } : {}),
      steps,
    });
    driver.drive();
    return driver;
  }

  it("removes the adopted dir once the anchor direction matches the inherited one again", async () => {
    const driver = twoStepRun([{ element: "#rtl-target", popover: { title: "A", side: "bottom" } }]);
    const host = document.getElementById("rtl-host")!;
    const wrapper = popoverEl()!;
    expect(wrapper.getAttribute("dir")).toBe("rtl");

    host.style.direction = "ltr";
    driver.refresh();
    await tick(50);
    expect(popoverEl()).toBe(wrapper);
    expect(wrapper.hasAttribute("dir")).toBe(false);

    host.style.direction = "rtl";
    driver.refresh();
    await tick(50);
    expect(wrapper.getAttribute("dir")).toBe("rtl");

    host.style.direction = "ltr";
    driver.refresh();
    await tick(50);
    expect(wrapper.hasAttribute("dir")).toBe(false);
  });

  it("does not remove a dir it did not set", async () => {
    const driver = twoStepRun([{ element: "#target", popover: { title: "A", side: "bottom" } }]);
    const wrapper = popoverEl()!;
    wrapper.setAttribute("dir", "ltr");
    driver.refresh();
    await tick(50);
    expect(wrapper.getAttribute("dir")).toBe("ltr");
  });

  it("a targetless pass drops an adopted dir even when it equals the page direction", () => {
    document.documentElement.style.direction = "ltr";
    const mount = document.createElement("div");
    mount.style.direction = "rtl";
    const wrapper = document.createElement("div");
    wrapper.className = "vt-popover";
    mount.appendChild(wrapper);
    document.body.appendChild(mount);
    const popover = { wrapper, arrow: document.createElement("div") } as PopoverDOM;
    const options: PositionOptions = { side: "bottom", align: "start", offset: 0, padding: 0, hasTarget: true };
    const target = document.getElementById("target")!;

    repositionPopover(popover, target, options);
    expect(wrapper.getAttribute("dir")).toBe("ltr");

    repositionPopover(popover, target, { ...options, hasTarget: false });
    expect(wrapper.hasAttribute("dir")).toBe(false);
    expect(getComputedStyle(wrapper).direction).toBe("rtl");
  });

  it("restores a foreign dir it overwrote once the adoption ends", async () => {
    const driver = twoStepRun([{ element: "#rtl-target", popover: { title: "A", side: "bottom" } }]);
    const wrapper = popoverEl()!;
    const host = document.getElementById("rtl-host")!;
    host.style.direction = "ltr";
    driver.refresh();
    await tick(50);
    wrapper.setAttribute("dir", "ltr");
    host.style.direction = "rtl";
    driver.refresh();
    await tick(50);
    expect(wrapper.getAttribute("dir")).toBe("rtl");
    host.style.direction = "ltr";
    driver.refresh();
    await tick(50);
    expect(popoverEl()).toBe(wrapper);
    expect(wrapper.getAttribute("dir")).toBe("ltr");
    driver.destroy();
  });

  it("a centered step in a right-to-left mount on a left-to-right page keeps the inherited direction", () => {
    const driver = twoStepRun([{ popover: { title: "Centered" } }], "rtl");
    const wrapper = popoverEl()!;
    expect(wrapper.hasAttribute("dir")).toBe(false);
    expect(getComputedStyle(wrapper).direction).toBe("rtl");
    driver.destroy();
  });
});
