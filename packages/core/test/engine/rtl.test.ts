import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositionInfo } from "../../src/engine/driver";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

const POPOVER = { width: 200, height: 100 };
const W = window.innerWidth;

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

type Dir = "ltr" | "rtl";

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  document.body.innerHTML = `<button id="target" type="button">T</button>`;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.direction = "";
});

type Setup = {
  side?: "top" | "bottom" | "left" | "right" | "over" | "auto";
  align?: "start" | "center" | "end";
  cross?: number;
};

function show(dir: Dir, targetRect: DOMRect, { side = "top", align = "start", cross }: Setup = {}) {
  document.documentElement.style.direction = dir;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "target") return targetRect;
    if (this.classList.contains("vt-popover")) {
      const style = (this as HTMLElement).style;
      const left = style.left === "auto" ? W - parseFloat(style.right) - POPOVER.width : parseFloat(style.left) || 0;
      const top = style.top === "auto" ? window.innerHeight - parseFloat(style.bottom) - POPOVER.height : parseFloat(style.top) || 0;
      return rect(left, top, POPOVER.width, POPOVER.height);
    }
    return rect(0, 0, 10, 10);
  });
  const infos: RepositionInfo[] = [];
  const driver = createDriver({
    animate: false,
    stagePadding: 0,
    popoverOffset: 0,
    onReposition: info => infos.push(info),
    steps: [
      {
        element: "#target",
        ...(cross === undefined ? {} : { popoverCrossOffset: cross }),
        popover: { title: "T", side, align },
      },
    ],
  });
  driver.drive();

  return { wrapper: popoverEl()!, info: infos.at(-1)!, arrow: document.querySelector<HTMLElement>(".vt-popover-arrow")! };
}

const left = (el: HTMLElement) => parseFloat(el.style.left);
const right = (el: HTMLElement) => left(el) + POPOVER.width;
const TARGET = rect(400, 300, 100, 40);

describe("start and end alignment", () => {
  it("LTR start aligns the left edges", () => {
    expect(left(show("ltr", TARGET, { align: "start" }).wrapper)).toBe(400);
  });

  it("RTL start aligns the right edges", () => {
    expect(right(show("rtl", TARGET, { align: "start" }).wrapper)).toBe(500);
  });

  it("LTR end aligns the right edges", () => {
    expect(right(show("ltr", TARGET, { align: "end" }).wrapper)).toBe(500);
  });

  it("RTL end aligns the left edges", () => {
    expect(left(show("rtl", TARGET, { align: "end" }).wrapper)).toBe(400);
  });

  it("center is the same in both directions", () => {
    expect(left(show("ltr", TARGET, { align: "center" }).wrapper)).toBe(350);
    expect(left(show("rtl", TARGET, { align: "center" }).wrapper)).toBe(350);
  });

  it("reports the logical alignment and the class in both directions", () => {
    for (const dir of ["ltr", "rtl"] as const) {
      const { info, wrapper } = show(dir, TARGET, { align: "start" });
      expect(info.align).toBe("start");
      expect(wrapper.classList.contains("vt-popover-align-start")).toBe(true);
    }
  });

  it("flips to the opposite logical alignment at the edge", () => {
    const edge = rect(W - 110, 300, 100, 40);
    const ltr = show("ltr", edge, { align: "start" });
    expect(ltr.info.align).toBe("end");
    expect(right(ltr.wrapper)).toBe(W - 10);
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    const mirrored = rect(10, 300, 100, 40);
    const rtl = show("rtl", mirrored, { align: "start" });
    expect(rtl.info.align).toBe("end");
    expect(left(rtl.wrapper)).toBe(10);
  });
});

describe("rtl class", () => {
  it("is added only in right-to-left layouts", () => {
    expect(show("rtl", TARGET).wrapper.classList.contains("vt-popover-rtl")).toBe(true);
  });

  it("is absent in left-to-right layouts", () => {
    expect(show("ltr", TARGET).wrapper.classList.contains("vt-popover-rtl")).toBe(false);
  });
});

describe("cross offset", () => {
  it("LTR moves toward the right", () => {
    expect(left(show("ltr", TARGET, { cross: 20 }).wrapper)).toBe(420);
  });

  it("RTL moves toward the left", () => {
    expect(left(show("rtl", TARGET, { cross: 20 }).wrapper)).toBe(500 - POPOVER.width - 20);
  });

  it("is not mirrored on the vertical axis", () => {
    const top = (el: HTMLElement) => parseFloat(el.style.top);
    const ltr = top(show("ltr", rect(500, 300, 100, 40), { side: "right", cross: 20 }).wrapper);
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    const rtl = top(show("rtl", rect(500, 300, 100, 40), { side: "right", cross: 20 }).wrapper);
    expect(ltr).toBe(320);
    expect(rtl).toBe(320);
  });

  it("is applied before the clamp", () => {
    const edge = rect(W - 130, 300, 100, 40);
    expect(right(show("ltr", edge, { align: "end", cross: 500 }).wrapper)).toBeLessThanOrEqual(W - 10);
  });
});

describe("side fallback", () => {
  const cramped = rect(400, 10, 100, 40);

  it("LTR prefers left when top does not fit", () => {
    expect(show("ltr", cramped).info.side).toBe("left");
  });

  it("RTL prefers right when top does not fit", () => {
    expect(show("rtl", cramped).info.side).toBe("right");
  });

  const tied = rect((W - 100) / 2, 300, 100, 400);

  it("auto breaks a left and right tie toward right in LTR", () => {
    expect(show("ltr", tied, { side: "auto" }).info.side).toBe("right");
  });

  it("auto breaks a left and right tie toward left in RTL", () => {
    expect(show("rtl", tied, { side: "auto" }).info.side).toBe("left");
  });
});

describe("arrow", () => {
  it("offset mirrors for a partial overlap", () => {
    const ltr = show("ltr", TARGET, { align: "start" });
    expect(parseFloat(ltr.arrow.style.left)).toBe(45);
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    const rtl = show("rtl", TARGET, { align: "start" });
    expect(parseFloat(rtl.arrow.style.left)).toBe(145);
  });

  it("sits at the inline-start corner for a spanning target", () => {
    const wide = rect(300, 300, 400, 40);
    expect(parseFloat(show("ltr", wide, { align: "start" }).arrow.style.left)).toBe(15);
    document.body.innerHTML = `<button id="target" type="button">T</button>`;
    vi.restoreAllMocks();
    expect(parseFloat(show("rtl", wide, { align: "start" }).arrow.style.left)).toBe(175);
  });
});
