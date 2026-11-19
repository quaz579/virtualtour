import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { StepConfig, Tour, TourConfig } from "../src/index";
import { setCurrentTour } from "../src/registry";
import { nextFrame, pressKey } from "./engine/utils";

const created: Tour[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const PAGE = `<button id="t" type="button">Target</button><p id="p">Paragraph</p><a id="a" href="#x">Link</a><div id="r" role="button" tabindex="0">Role</div><select id="s"><option>One</option></select><input id="ib" type="submit" value="Go" /><details><summary id="sum">More</summary>Text</details><input id="tx" type="text" aria-label="Text" /><div id="rc" role="Button" tabindex="0">Mixed</div>`;

async function show(config: TourConfig): Promise<Tour> {
  document.body.innerHTML = PAGE;
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  await tour.start();
  return tour;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover")!;
const describedBy = () => (wrapper().getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
const liveRegion = () => document.querySelector<HTMLElement>(".vt-live-region")!;

const bodies: [string, NonNullable<StepConfig["body"]>, string][] = [
  ["a string body", "Plain text", "vt-popover-description"],
  ["an Element body", Object.assign(document.createElement("p"), { textContent: "Element text" }), "vt-popover-body"],
];
const names: [string, StepConfig, { labelledby: string | null; label: string | null }][] = [
  ["a title", { title: "Heading" }, { labelledby: "vt-popover-title", label: null }],
  ["a label only", { label: "Welcome" }, { labelledby: null, label: "Welcome" }],
  ["a title and a label", { title: "Heading", label: "Ignored" }, { labelledby: "vt-popover-title", label: null }],
  ["neither", {}, { labelledby: null, label: null }],
];

describe("dialog name and description matrix", () => {
  for (const [bodyName, body, bodyId] of bodies) {
    for (const [nameName, config, expected] of names) {
      for (const instruction of [false, true]) {
        it(`${nameName}, ${bodyName}, ${instruction ? "with" : "without"} an instruction`, async () => {
          vi.spyOn(console, "warn").mockImplementation(() => {});
          const target = instruction ? { target: "#t", autoAdvance: { event: "click" } } : { target: "#t" };
          await show({
            steps: [{ id: "s", body, ...config, ...target, ...(instruction ? { instruction: "Press it" } : {}) }],
          });
          const el = wrapper();
          expect(el.getAttribute("role")).toBe("dialog");
          expect(el.getAttribute("aria-labelledby")).toBe(expected.labelledby);
          expect(el.getAttribute("aria-label")).toBe(expected.label);
          const ids = describedBy();
          expect(ids).toContain(bodyId);
          expect(ids.includes("vt-popover-instruction-text")).toBe(instruction);
          for (const id of ids.filter((value) => value !== "vt-popover-description" || bodyId === value)) {
            expect(document.getElementById(id)).not.toBeNull();
          }
          if (expected.labelledby) expect(document.getElementById(expected.labelledby)!.textContent).toBe("Heading");
        });
      }
    }
  }

  it("warns once in development when a step has neither title nor label", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = await show({ steps: [{ id: "one", target: "#t", body: "x" }, { id: "two", target: "#t", body: "y" }] });
    await tour.forward();
    const unnamed = warn.mock.calls.filter((call) => String(call[0]).includes("no accessible name"));
    expect(unnamed).toHaveLength(1);
    expect(String(unnamed[0]![0])).toContain('Step "one"');
  });

  it("does not warn when the step has a title or a label", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = await show({ steps: [{ title: "T", target: "#t" }, { label: "L", target: "#t" }] });
    await tour.forward();
    expect(warn.mock.calls.filter((call) => String(call[0]).includes("no accessible name"))).toHaveLength(0);
  });
});

describe("named controls", () => {
  it("gives the close button an accessible name and honors a custom label", async () => {
    await show({ steps: [{ title: "T", target: "#t", closeButton: { label: "Dismiss tour" } }] });
    expect(wrapper().querySelector(".vt-popover-close-btn")!.getAttribute("aria-label")).toBe("Dismiss tour");
  });

  it("defaults the close button label to a non-empty string", async () => {
    await show({ steps: [{ title: "T", target: "#t" }] });
    expect(wrapper().querySelector(".vt-popover-close-btn")!.getAttribute("aria-label")).toMatch(/\S/);
  });

  it("renders every footer button as a native button with visible text", async () => {
    await show({
      steps: [
        { title: "A", target: "#t" },
        { title: "B", target: "#t" },
      ],
    });
    for (const button of wrapper().querySelectorAll<HTMLButtonElement>(".vt-popover-footer button")) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.type).toBe("button");
      expect(button.textContent).toMatch(/\S/);
    }
  });

  it("gives custom buttons their text or label as the accessible name", async () => {
    await show({
      steps: [{ title: "A", target: "#t", buttons: [{ text: "Go", label: "Go to the next step", action: "forward" }, { text: "Stay", action: "exit" }] }],
    });
    const buttons = [...wrapper().querySelectorAll<HTMLButtonElement>(".vt-footer .vt-button")];
    expect(buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Go to the next step", "Stay"]);
  });

  it("marks a gated Next button aria-disabled while it stays focusable", async () => {
    await show({ steps: [{ title: "A", target: "#t", instruction: "Press it", autoAdvance: { event: "click" } }, { title: "B", target: "#t" }] });
    const next = wrapper().querySelector<HTMLButtonElement>(".vt-popover-next-btn")!;
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(next.disabled).toBe(false);
  });
});

describe("popup attributes on targets", () => {
  const cases: [string, string, boolean][] = [
    ["a button", "#t", true],
    ["a link with an href", "#a", true],
    ["an element with a button role", "#r", true],
    ["a select", "#s", true],
    ["a submit input", "#ib", true],
    ["a summary", "#sum", true],
    ["a button role written in mixed case", "#rc", true],
    ["a text input", "#tx", false],
    ["a paragraph", "#p", false],
  ];

  for (const [name, selector, expected] of cases) {
    it(`${expected ? "marks" : "leaves unmarked"} ${name}`, async () => {
      await show({ steps: [{ title: "A", target: selector }] });
      const target = document.querySelector(selector)!;
      expect(target.getAttribute("aria-haspopup") === "dialog").toBe(expected);
      expect(target.getAttribute("aria-expanded") === "true").toBe(expected);
      expect(target.getAttribute("aria-controls") === "vt-popover-content").toBe(expected);
    });
  }

  it("removes the marks from a button when the tour ends", async () => {
    const tour = await show({ steps: [{ title: "A", target: "#t" }] });
    tour.finish();
    expect(document.querySelector("#t")!.hasAttribute("aria-haspopup")).toBe(false);
    expect(document.querySelector("#t")!.hasAttribute("aria-expanded")).toBe(false);
  });
});

describe("focus", () => {
  it("moves focus into the popover on show and returns it to the trigger on exit", async () => {
    document.body.innerHTML = PAGE;
    document.querySelector<HTMLElement>("#a")!.focus();
    const tour = createTour({ animate: false, steps: [{ title: "A", target: "#t" }, { title: "B", target: "#t" }, { title: "C", target: "#t" }] });
    created.push(tour);
    await tour.start();
    expect(wrapper().contains(document.activeElement)).toBe(true);
    await tour.forward();
    await tour.forward();
    expect(wrapper().contains(document.activeElement)).toBe(true);
    tour.finish();
    expect(document.activeElement?.id).toBe("a");
  });

  it("keeps the first trigger as the return target when the popover button had focus on a later step", async () => {
    document.body.innerHTML = PAGE;
    document.querySelector<HTMLElement>("#r")!.focus();
    const tour = createTour({ animate: false, steps: [{ title: "A", target: "#t" }, { title: "B", target: "#t" }] });
    created.push(tour);
    await tour.start();
    wrapper().querySelector<HTMLButtonElement>(".vt-popover-next-btn")!.click();
    await nextFrame();
    await Promise.resolve();
    expect(tour.currentStep?.config.title).toBe("B");
    expect(wrapper().contains(document.activeElement)).toBe(true);
    tour.finish();
    expect(document.activeElement?.id).toBe("r");
  });
});

describe("keyboard", () => {
  it("exits on Escape and navigates with the arrows", async () => {
    const tour = await show({ steps: [{ id: "a", title: "A", target: "#t" }, { id: "b", title: "B", target: "#t" }] });
    pressKey("ArrowRight");
    await nextFrame();
    expect(tour.currentStep?.id).toBe("b");
    pressKey("ArrowLeft");
    await nextFrame();
    expect(tour.currentStep?.id).toBe("a");
    pressKey("Escape");
    await nextFrame();
    expect(tour.isRunning()).toBe(false);
  });

  it("ignores Escape when keys.escape is false", async () => {
    const tour = await show({ keys: { escape: false }, steps: [{ title: "A", target: "#t" }] });
    pressKey("Escape");
    await nextFrame();
    expect(tour.isRunning()).toBe(true);
  });

  it("ignores the arrows when keys.arrows is false", async () => {
    const tour = await show({ keys: { arrows: false }, steps: [{ id: "a", title: "A", target: "#t" }, { id: "b", title: "B", target: "#t" }] });
    pressKey("ArrowRight");
    await nextFrame();
    expect(tour.currentStep?.id).toBe("a");
  });

  it("leaves arrows and Escape to an input on the page", async () => {
    document.body.innerHTML = `${PAGE}<input id="field" type="text" />`;
    const tour = createTour({ animate: false, steps: [{ id: "a", title: "A", target: "#field" }, { id: "b", title: "B", target: "#t" }] });
    created.push(tour);
    await tour.start();
    const field = document.querySelector<HTMLInputElement>("#field")!;
    field.focus();
    for (const key of ["ArrowRight", "Escape"]) {
      field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true }));
      field.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, composed: true }));
    }
    await nextFrame();
    expect(tour.isRunning()).toBe(true);
    expect(tour.currentStep?.id).toBe("a");
  });
});

describe("reduced motion", () => {
  const stub = (reduce: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce") ? reduce : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

  it("uses the simple, non-fading mode when the user prefers reduced motion", async () => {
    stub(true);
    await show({ animate: true, steps: [{ title: "A", target: "#t" }] });
    expect(document.body.classList.contains("vt-simple")).toBe(true);
    expect(document.body.classList.contains("vt-fade")).toBe(false);
    expect(document.body.hasAttribute("data-vt-fade")).toBe(false);
  });

  it("fades when the user has no preference and animation is on", async () => {
    stub(false);
    await show({ animate: true, steps: [{ title: "A", target: "#t" }] });
    expect(document.body.classList.contains("vt-fade")).toBe(true);
    expect(document.body.hasAttribute("data-vt-fade")).toBe(true);
  });
});

describe("live region", () => {
  it("is a polite, atomic region that is mounted while a tour runs and removed after", async () => {
    const tour = await show({ steps: [{ title: "A", target: "#t" }] });
    expect(liveRegion().getAttribute("aria-live")).toBe("polite");
    expect(liveRegion().getAttribute("aria-atomic")).toBe("true");
    tour.finish();
    expect(document.querySelector(".vt-live-region")).toBeNull();
  });

  it("announces the new title after configure()", async () => {
    const tour = await show({ steps: [{ title: "Old title", target: "#t" }] });
    tour.steps[0]!.configure({ title: "New title" });
    expect(liveRegion().textContent).toBe("New title");
  });

  it("announces a changed description after configure()", async () => {
    const tour = await show({ steps: [{ title: "Same", body: "Before", target: "#t" }] });
    tour.steps[0]!.configure({ body: "After" });
    expect(liveRegion().textContent).toBe("After");
  });

  it("announces nothing when configure() changes no text", async () => {
    const tour = await show({ steps: [{ title: "Same", target: "#t" }] });
    const before = liveRegion().textContent;
    tour.steps[0]!.configure({ classes: "extra" });
    expect(liveRegion().textContent).toBe(before);
  });
});
