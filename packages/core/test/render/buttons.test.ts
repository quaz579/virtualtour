import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { ButtonConfig, Tour, TourConfig } from "../../src/index";
import { setCurrentTour } from "../../src/registry";
import { findExecutable, FLAG, PAYLOADS, pwned, stripSanitizer } from "../payloads";

const created: Tour[] = [];

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  delete (window as unknown as Record<string, unknown>)[FLAG];
  vi.restoreAllMocks();
});

async function show(config: TourConfig): Promise<Tour> {
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  await tour.start();
  return tour;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover")!;
const footer = () => wrapper().querySelector<HTMLElement>(".vt-footer");
const buttons = () => Array.from(wrapper().querySelectorAll<HTMLButtonElement>(".vt-footer > .vt-button"));

describe("custom footer buttons", () => {
  it("renders one button per entry after the engine footer and hides next and back", async () => {
    await show({
      steps: [{ title: "T", buttons: [{ text: "One", action: "forward" }, { text: "Two", action: "exit" }] }, { title: "U" }],
    });
    expect(buttons().map((b) => b.textContent)).toEqual(["One", "Two"]);
    expect(buttons().every((b) => b.type === "button" && b.classList.contains("vt-button"))).toBe(true);
    expect(wrapper().querySelector(".vt-popover-footer")!.nextElementSibling).toBe(footer());
    expect(wrapper().querySelector<HTMLElement>(".vt-popover-next-btn")!.style.display).toBe("none");
    expect(wrapper().querySelector<HTMLElement>(".vt-popover-prev-btn")!.style.display).toBe("none");
    expect(wrapper().querySelector<HTMLElement>(".vt-popover-close-btn")!.style.display).not.toBe("none");
  });

  it("renders no footer when buttons is absent or empty", async () => {
    await show({ steps: [{ title: "T", buttons: [] }] });
    expect(footer()).toBeNull();
  });

  it("applies the secondary variant, extra classes, guarded attrs, label and function text", async () => {
    await show({
      steps: [
        {
          title: "T",
          buttons: [
            {
              text: () => "Dynamic",
              label: () => "Dynamic label",
              kind: "secondary",
              classes: ["a", "b"],
              attrs: { "data-track": "x", onclick: "window.hit=1", class: "evil", id: "evil", "aria-label": "evil", type: "submit", style: "color:red" },
              action: "forward",
            },
            { text: "Plain", classes: "c d", action: "forward" },
          ],
        },
      ],
    });
    const [first, second] = buttons();
    expect(first!.textContent).toBe("Dynamic");
    expect(first!.className).toBe("vt-button vt-button--secondary a b");
    expect(first!.getAttribute("aria-label")).toBe("Dynamic label");
    expect(first!.getAttribute("data-track")).toBe("x");
    expect(first!.hasAttribute("onclick")).toBe(false);
    expect(first!.id).toBe("");
    expect(first!.type).toBe("button");
    expect(first!.hasAttribute("style")).toBe(false);
    expect(second!.className).toBe("vt-button c d");
    expect(second!.hasAttribute("aria-label")).toBe(false);
  });

  it("resolves disabled at show time, from a boolean or a function", async () => {
    let off = true;
    await show({
      steps: [
        {
          title: "T",
          buttons: [
            { text: "A", disabled: true, action: "forward" },
            { text: "B", disabled: () => off, action: "forward" },
            { text: "C", disabled: () => false, action: "forward" },
          ],
        },
      ],
    });
    expect(buttons().map((b) => b.disabled)).toEqual([true, true, false]);
    expect(off).toBe(true);
  });

  it("maps string actions to the tour methods", async () => {
    const tour = await show({
      steps: [
        {
          title: "One",
          buttons: [
            { text: "fwd", action: "forward" },
            { text: "fin", action: "finish" },
            { text: "ex", action: "exit" },
          ],
        },
        {
          title: "Two",
          buttons: [{ text: "back", action: "backward" }],
        },
      ],
    });
    const forward = vi.spyOn(tour, "forward");
    const backward = vi.spyOn(tour, "backward");
    const finish = vi.spyOn(tour, "finish");
    const exit = vi.spyOn(tour, "exit");
    buttons()[0]!.click();
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("step-2"));
    expect(forward).toHaveBeenCalledTimes(1);
    buttons()[0]!.click();
    await vi.waitFor(() => expect(tour.currentStep?.id).toBe("step-1"));
    expect(backward).toHaveBeenCalledTimes(1);
    buttons()[1]!.click();
    expect(finish).toHaveBeenCalledTimes(1);
    expect(tour.isRunning()).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it("exit action ends the tour", async () => {
    const tour = await show({ steps: [{ title: "One", buttons: [{ text: "ex", action: "exit" }] }] });
    const exit = vi.spyOn(tour, "exit");
    buttons()[0]!.click();
    await vi.waitFor(() => expect(tour.isRunning()).toBe(false));
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("calls a function action with the tour and the step", async () => {
    const action = vi.fn();
    const tour = await show({ steps: [{ id: "one", title: "One", buttons: [{ text: "go", action }] }] });
    buttons()[0]!.click();
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0]).toEqual({ tour, step: tour.stepById("one") });
  });

  it("a throwing function action is reported and the tour keeps running", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tour = await show({
      steps: [{ title: "One", buttons: [{ text: "go", action: () => { throw new Error("boom"); } }] }],
    });
    buttons()[0]!.click();
    expect(error).toHaveBeenCalled();
    expect(tour.isRunning()).toBe(true);
  });

  it("an unknown action warns and does nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = await show({ steps: [{ title: "One", buttons: [{ text: "go", action: "next" as never }] }] });
    buttons()[0]!.click();
    expect(warn).toHaveBeenCalled();
    expect(tour.isRunning()).toBe(true);
  });

  it("a disabled button does not run its action", async () => {
    const action = vi.fn();
    await show({ steps: [{ title: "One", buttons: [{ text: "go", disabled: true, action }] }] });
    buttons()[0]!.click();
    expect(action).not.toHaveBeenCalled();
  });

  it("a throwing text function falls back to empty text and the step still shows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await show({ steps: [{ title: "One", buttons: [{ text: () => { throw new Error("x"); }, action: "forward" }] }] });
    expect(buttons()[0]!.textContent).toBe("");
  });

  it("builds fresh buttons for each step and removes the footer when the next step has none", async () => {
    const tour = await show({
      steps: [{ title: "One", buttons: [{ text: "a", action: "forward" }] }, { title: "Two" }],
    });
    expect(footer()).not.toBeNull();
    await tour.forward();
    expect(footer()).toBeNull();
  });
});

describe("focus", () => {
  it("first-button focuses the first enabled layer button", async () => {
    await show({
      steps: [
        {
          title: "T",
          focus: "first-button",
          buttons: [
            { text: "off", disabled: true, action: "forward" },
            { text: "on", action: "forward" },
          ],
        },
      ],
    });
    expect(document.activeElement).toBe(buttons()[1]);
  });

  it("dialog focus (the default) leaves focus on the dialog", async () => {
    await show({ steps: [{ title: "T", buttons: [{ text: "on", action: "forward" }] }] });
    expect(document.activeElement).toBe(wrapper());
  });

  it("first-button without buttons leaves the engine's own focus alone", async () => {
    await show({ steps: [{ title: "T", focus: "first-button" }] });
    expect(document.activeElement).toBe(wrapper().querySelector(".vt-popover-next-btn"));
  });
});

describe.each(Object.entries(PAYLOADS))("%s payload in button text", (_name, payload) => {
  const markup = `ok ${payload} end`;
  const defs: ButtonConfig[] = [
    { text: markup, action: "forward" },
    { text: () => markup, action: "forward" },
  ];

  it("is cleaned by the tour sanitizer", async () => {
    const sanitize = vi.fn(stripSanitizer);
    await show({ sanitize, steps: [{ title: "T", buttons: defs }] });
    expect(findExecutable(wrapper())).toEqual([]);
    expect(sanitize).toHaveBeenCalled();
    expect(pwned()).toBeUndefined();
  });

  it("is shown as literal text when the sanitizer throws or returns a non-string", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await show({
      sanitize: (html: string) => {
        if (html.includes("<")) throw new Error("nope");
        return html;
      },
      steps: [{ title: "T", buttons: defs }],
    });
    expect(findExecutable(wrapper())).toEqual([]);
    expect(buttons()[0]!.textContent).toBe(markup);
    expect(pwned()).toBeUndefined();
  });

  it("is never parsed as HTML without a sanitizer", async () => {
    await show({ steps: [{ title: "T", buttons: defs }] });
    expect(buttons()[0]!.children.length).toBe(0);
    expect(buttons()[0]!.textContent).toBe(markup);
    expect(pwned()).toBeUndefined();
  });
});
