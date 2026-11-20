import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { Tour } from "../src/index";
import { setCurrentTour } from "../src/registry";
import type { Presenter, RepositionInfo, StepConfig } from "../src/types";

const W = window.innerWidth;
const H = window.innerHeight;
const POPOVER = { width: 200, height: 100 };

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

let active: Tour | undefined;

afterEach(() => {
  if (active?.isRunning()) active.finish();
  active = undefined;
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  document.documentElement.style.direction = "";
  vi.restoreAllMocks();
});

async function run(dir: "ltr" | "rtl", target: DOMRect, placement: NonNullable<StepConfig["placement"]>) {
  document.documentElement.style.direction = dir;
  document.body.innerHTML = `<button id="t" type="button">T</button>`;
  Element.prototype.scrollIntoView = () => {};
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "t") return target;
    if (this.classList.contains("vt-popover")) {
      const style = (this as HTMLElement).style;
      const left = style.left === "auto" ? W - parseFloat(style.right) - POPOVER.width : parseFloat(style.left) || 0;
      const top = style.top === "auto" ? H - parseFloat(style.bottom) - POPOVER.height : parseFloat(style.top) || 0;
      return rect(left, top, POPOVER.width, POPOVER.height);
    }
    return rect(0, 0, 10, 10);
  });
  const infos: RepositionInfo[] = [];
  const presenter: Presenter = {
    mount: () => undefined,
    afterShow: () => undefined,
    afterReposition: (_popover, _step, info) => {
      infos.push(info);
    },
    update: () => undefined,
    beforeLeave: () => undefined,
    unmount: () => undefined,
  };
  active = createTour({
    animate: false,
    presenter: () => presenter,
    steps: [{ id: "a", title: "A", body: "B", target: "#t", placement, position: { offset: 0 } }],
  });
  await active.start();

  return infos.at(-1)!;
}

describe("the tour forwards the engine's reposition info to the presenter", () => {
  it("right-to-left bottom start reports a physical right edge", async () => {
    const info = await run("rtl", rect(400, 300, 100, 40), { side: "bottom", align: "start" });

    expect(info).toMatchObject({ side: "bottom", align: "start", physicalAlign: "right", rtl: true, pinned: false });
    expect(info.targetRect).not.toBeNull();
  });

  it("left-to-right bottom start reports a physical left edge", async () => {
    const info = await run("ltr", rect(400, 300, 100, 40), { side: "bottom", align: "start" });

    expect(info).toMatchObject({ physicalAlign: "left", rtl: false, pinned: false });
  });

  it("a popover that fits nowhere reports pinned and a centered edge", async () => {
    const info = await run("rtl", rect(10, 10, W - 20, H - 20), { side: "top", align: "start" });

    expect(info).toMatchObject({ side: "top", physicalAlign: "center", rtl: true, pinned: true });
  });
});
