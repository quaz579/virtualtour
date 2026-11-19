import { afterEach, describe, expect, it, vi } from "vitest";
import type { DriveStep, EnginePresenter, RepositionInfo } from "../../src/engine/driver";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

afterEach(() => {
  vi.restoreAllMocks();
});

const speaker: EnginePresenter = { layout: "speaker", mount: () => undefined };

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

const WRAPPER = { width: 260, height: 120 };
const BUBBLE = { dx: 60, dy: 20, width: 200, height: 100 };

function stubLayout(target: DOMRect) {
  const wrapperRect = (el: HTMLElement) => {
    const { style } = el;
    const left = style.left === "auto" ? window.innerWidth - parseFloat(style.right) - WRAPPER.width : parseFloat(style.left) || 0;
    const top = style.top === "auto" ? window.innerHeight - parseFloat(style.bottom) - WRAPPER.height : parseFloat(style.top) || 0;
    return rect(left, top, WRAPPER.width, WRAPPER.height);
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.id === "intro") return target;
    if (this.classList.contains("vt-popover")) return wrapperRect(this as HTMLElement);
    if (this.classList.contains("vt-bubble")) {
      const wrapper = wrapperRect(this.parentElement as HTMLElement);
      return rect(wrapper.left + BUBBLE.dx, wrapper.top + BUBBLE.dy, BUBBLE.width, BUBBLE.height);
    }
    return rect(0, 0, 10, 10);
  });
}

type Setup = {
  side?: "top" | "bottom" | "left" | "right" | "over";
  align?: "start" | "center" | "end";
  presenter?: EnginePresenter | null;
  step?: Partial<DriveStep>;
};

function show({ side = "bottom", align = "start", presenter = speaker, step = {} }: Setup = {}) {
  const infos: RepositionInfo[] = [];
  const d = createDriver({
    animate: false,
    stagePadding: 0,
    onReposition: info => infos.push(info),
    ...(presenter ? { presenter } : {}),
    steps: [{ element: "#intro", popover: { title: "Hello", description: "World", side, align }, ...step }],
  });
  d.drive();

  return {
    d,
    infos,
    wrapper: popoverEl()!,
    arrow: document.querySelector<HTMLElement>(".vt-popover-arrow")!,
    bubble: document.querySelector<HTMLElement>(".vt-bubble"),
  };
}

const TARGET = rect(400, 300, 100, 40);

describe("dialog layout", () => {
  it("renders the stock structure", () => {
    const d = createDriver({ animate: false, steps: [{ element: "#intro", popover: { title: "Hello", description: "World" } }] });
    d.drive();
    const html = popoverEl()!.outerHTML.replace(/ style="[^"]*"/g, "");

    expect(html).toMatchInlineSnapshot(`"<div class="vt-popover vt-popover-side-bottom vt-popover-align-end" aria-describedby="vt-popover-description" aria-labelledby="vt-popover-title" id="vt-popover-content" role="dialog" data-vt-side="bottom" data-vt-step="0"><button type="button" class="vt-popover-close-btn" aria-label="Close">×</button><div class="vt-popover-arrow vt-popover-arrow-side-right"></div><div id="vt-popover-title" class="vt-popover-title">Hello</div><div id="vt-popover-description" class="vt-popover-description">World</div><div class="vt-popover-footer"><span class="vt-popover-progress-text">1 of 1</span><span class="vt-popover-navigation-btns"><button type="button" class="vt-popover-prev-btn vt-popover-footer-btn vt-popover-btn-disabled" disabled="">Previous</button><button type="button" class="vt-popover-next-btn vt-popover-footer-btn vt-popover-done-btn">Done</button></span></div></div>"`);
  });

  it("has no bubble, avatar slot or speaker class", () => {
    const { wrapper } = show({ presenter: null });

    expect(wrapper.classList.contains("vt-speaker")).toBe(false);
    expect(wrapper.hasAttribute("data-vt-dock")).toBe(false);
    expect(wrapper.querySelector(".vt-bubble, .vt-avatar-slot")).toBeNull();
  });

  it("is what a presenter declaring layout dialog gets", () => {
    const { wrapper } = show({ presenter: { layout: "dialog", mount: () => undefined } });

    expect(wrapper.querySelector(".vt-bubble")).toBeNull();
  });
});

describe("speaker structure", () => {
  it("builds the arrow, bubble and avatar slot as the wrapper's children in that order", () => {
    const { wrapper } = show();

    expect(wrapper.className.split(" ")).toEqual(expect.arrayContaining(["vt-popover", "vt-speaker"]));
    expect(wrapper.getAttribute("data-vt-dock")).toBe("end");
    expect(wrapper.getAttribute("role")).toBe("dialog");
    expect([...wrapper.children].map(child => child.className.split(" ")[0])).toEqual([
      "vt-popover-arrow",
      "vt-bubble",
      "vt-avatar-slot",
    ]);
    expect(wrapper.querySelector(".vt-popover-arrow")!.classList.contains("vt-bubble-tail")).toBe(true);
    expect(wrapper.querySelector(".vt-avatar-slot")!.children).toHaveLength(0);
  });

  it("puts the close button, title, description and footer inside the bubble", () => {
    const { bubble } = show();

    expect([...bubble!.children].map(child => child.className.split(" ")[0])).toEqual([
      "vt-popover-close-btn",
      "vt-popover-title",
      "vt-popover-description",
      "vt-popover-footer",
    ]);
  });

  it("points the PopoverDOM references at the elements inside the bubble", () => {
    let dom: Parameters<EnginePresenter["mount"]>[0] | undefined;
    show({ presenter: { layout: "speaker", mount: popover => (dom = popover) } });

    expect(dom!.bubble).toBe(document.querySelector(".vt-bubble"));
    expect(dom!.avatarSlot).toBe(document.querySelector(".vt-avatar-slot"));
    for (const part of [dom!.title, dom!.description, dom!.footer, dom!.closeButton, dom!.nextButton, dom!.progress]) {
      expect(dom!.bubble!.contains(part)).toBe(true);
    }
    expect(dom!.bubble!.contains(dom!.arrow)).toBe(false);
  });

  it("keeps aria-labelledby on the wrapper and names the dialog by the title", () => {
    const { wrapper } = show();

    expect(wrapper.getAttribute("aria-labelledby")).toBe("vt-popover-title");
    expect(wrapper.querySelector("#vt-popover-title")!.textContent).toBe("Hello");
  });

  it("keeps the arrow and bubble tail classes after every reposition", () => {
    const { d, arrow } = show();
    d.refresh();

    expect(arrow.classList.contains("vt-bubble-tail")).toBe(true);
    expect(arrow.classList.contains("vt-popover-arrow")).toBe(true);
  });

  it("updates the title inside the bubble", () => {
    const { d, bubble } = show();
    d.updatePopover({ title: "Changed" });

    expect(bubble!.querySelector(".vt-popover-title")!.textContent).toBe("Changed");
    expect(document.querySelectorAll(".vt-popover-title")).toHaveLength(1);
  });

  it("inserts the instruction row inside the bubble before the footer", () => {
    const { bubble, wrapper } = show({ step: { popover: { title: "Hello", instruction: "Do it", side: "bottom" } } });
    const row = wrapper.querySelector(".vt-popover-instruction");

    expect(row).not.toBeNull();
    expect(row!.parentElement).toBe(bubble);
    expect(row!.nextElementSibling).toBe(bubble!.querySelector(".vt-popover-footer"));
  });

  it("leaves display to the stylesheet so a flex layout is not overridden, but keeps the dialog block", () => {
    expect(show().wrapper.style.display).toBe("");
    document.body.innerHTML = `<p id="intro">Intro</p>`;
    expect(show({ presenter: null }).wrapper.style.display).toBe("block");
  });

  it("creates a fresh structure for each step", () => {
    const d = createDriver({
      animate: false,
      presenter: speaker,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#card-1", popover: { title: "Two" } },
      ],
    });
    d.drive();
    d.moveNext();

    expect(document.querySelectorAll(".vt-bubble")).toHaveLength(1);
    expect(document.querySelector(".vt-bubble .vt-popover-title")!.textContent).toBe("Two");
  });
});

describe("bubbleRect", () => {
  it("is the bubble's rect in the speaker layout", () => {
    stubLayout(TARGET);
    const { infos, wrapper } = show();
    const info = infos.at(-1)!;

    expect(info.bubbleRect.left - info.wrapperRect.left).toBe(BUBBLE.dx);
    expect(info.bubbleRect.width).toBe(BUBBLE.width);
    expect(wrapper.querySelector(".vt-bubble")).not.toBeNull();
  });

  it("equals the wrapper rect in the dialog layout", () => {
    stubLayout(TARGET);
    const { infos } = show({ presenter: null });
    const info = infos.at(-1)!;

    expect(info.bubbleRect).toEqual(info.wrapperRect);
  });
});

describe("speaker arrow", () => {
  it("bottom: left is the bubble-relative offset plus the bubble's offset, and the tail sits on the bubble's top edge", () => {
    stubLayout(TARGET);
    const { arrow } = show({ side: "bottom" });

    expect(arrow.classList.contains("vt-popover-arrow-side-bottom")).toBe(true);
    expect(arrow.style.left).toBe("75px");
    expect(arrow.style.bottom).toBe("100px");
    expect(arrow.style.top).toBe("");
  });

  it("top: left as for bottom and the tail sits on the bubble's bottom edge", () => {
    stubLayout(TARGET);
    const { arrow } = show({ side: "top" });

    expect(arrow.classList.contains("vt-popover-arrow-side-top")).toBe(true);
    expect(arrow.style.left).toBe("75px");
    expect(arrow.style.top).toBe("120px");
    expect(arrow.style.bottom).toBe("");
  });

  it("right: top carries the bubble's vertical offset and right pins the tail to the bubble's left edge", () => {
    stubLayout(TARGET);
    const { arrow } = show({ side: "right" });

    expect(arrow.classList.contains("vt-popover-arrow-side-right")).toBe(true);
    expect(arrow.style.top).toBe("35px");
    expect(arrow.style.right).toBe("200px");
    expect(arrow.style.left).toBe("");
  });

  it("left: top carries the bubble's vertical offset and left pins the tail to the bubble's right edge", () => {
    stubLayout(TARGET);
    const { arrow } = show({ side: "left" });

    expect(arrow.classList.contains("vt-popover-arrow-side-left")).toBe(true);
    expect(arrow.style.top).toBe("35px");
    expect(arrow.style.left).toBe("260px");
    expect(arrow.style.right).toBe("");
  });

  it("leaves a dialog arrow with only the left offset", () => {
    stubLayout(TARGET);
    const { arrow } = show({ side: "bottom", presenter: null });

    expect(arrow.style.left).toMatch(/px$/);
    expect(arrow.style.bottom).toBe("");
    expect(arrow.classList.contains("vt-bubble-tail")).toBe(false);
  });

  it("clears the tail offsets for a centered step", () => {
    stubLayout(TARGET);
    const { arrow } = show({ side: "over" });

    expect(arrow.classList.contains("vt-popover-arrow-none")).toBe(true);
    expect(arrow.style.left + arrow.style.right + arrow.style.top + arrow.style.bottom).toBe("");
  });
});

describe("reposition info for docking", () => {
  const W = () => window.innerWidth;

  it("maps logical alignment to physical edges: ltr top/bottom", () => {
    stubLayout(TARGET);
    expect(show({ side: "bottom", align: "start" }).infos.at(-1)).toMatchObject({ physicalAlign: "left", rtl: false });
    document.body.innerHTML = `<p id="intro">Intro</p>`;
    expect(show({ side: "bottom", align: "end" }).infos.at(-1)).toMatchObject({ physicalAlign: "right" });
  });

  it("maps logical alignment to physical edges: rtl top/bottom swaps left and right", () => {
    document.body.innerHTML = `<div dir="rtl"><p id="intro">Intro</p></div>`;
    stubLayout(rect(W() / 2, 300, 100, 40));
    const start = show({ side: "bottom", align: "start" }).infos.at(-1)!;

    expect(start).toMatchObject({ rtl: true, align: "start", physicalAlign: "right" });
    document.body.innerHTML = `<div dir="rtl"><p id="intro">Intro</p></div>`;
    expect(show({ side: "bottom", align: "end" }).infos.at(-1)).toMatchObject({ rtl: true, physicalAlign: "left" });
  });

  it("maps left/right sides to top and bottom and is not mirrored in rtl", () => {
    document.body.innerHTML = `<div dir="rtl"><p id="intro">Intro</p></div>`;
    stubLayout(rect(W() / 2, 300, 100, 40));
    expect(show({ side: "right", align: "start" }).infos.at(-1)).toMatchObject({ physicalAlign: "top" });
    document.body.innerHTML = `<div dir="rtl"><p id="intro">Intro</p></div>`;
    expect(show({ side: "right", align: "end" }).infos.at(-1)).toMatchObject({ physicalAlign: "bottom" });
  });

  it("reports center for center alignment and for over", () => {
    stubLayout(TARGET);
    expect(show({ side: "bottom", align: "center" }).infos.at(-1)).toMatchObject({ physicalAlign: "center" });
    document.body.innerHTML = `<p id="intro">Intro</p>`;
    expect(show({ side: "over", align: "start" }).infos.at(-1)).toMatchObject({ physicalAlign: "center" });
  });

  it("flags a popover pinned because no side fit while still reporting the requested side", () => {
    stubLayout(rect(0, 0, window.innerWidth, window.innerHeight));
    const info = show({ side: "left", align: "start" }).infos.at(-1)!;

    expect(info).toMatchObject({ pinned: true, side: "left", physicalAlign: "center" });
  });

  it("does not flag a popover that found a side", () => {
    stubLayout(TARGET);

    expect(show({ side: "bottom" }).infos.at(-1)!.pinned).toBe(false);
  });
});
