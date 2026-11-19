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

function make(config: TourConfig): Tour {
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  return tour;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover")!;
const text = (selector: string) => wrapper().querySelector(selector)?.textContent;

describe("TourStep.element and isShown", () => {
  it("element is undefined before the first show, the wrapper while shown and after hide, null after dispose", async () => {
    const tour = make({ steps: [{ title: "A" }, { title: "B" }] });
    const [a, b] = tour.steps;
    expect(a!.element).toBeUndefined();
    expect(a!.isShown()).toBe(false);
    await tour.start();
    expect(a!.element).toBe(wrapper());
    expect(a!.isShown()).toBe(true);
    expect(b!.element).toBeUndefined();
    const first = a!.element;
    await tour.forward();
    expect(a!.isShown()).toBe(false);
    expect(a!.element).toBe(first);
    expect(b!.element).toBe(wrapper());
    tour.finish();
    expect(a!.element).toBeNull();
    expect(a!.isShown()).toBe(false);
    expect(b!.element).toBeNull();
  });

  it("hide keeps the element readable and isShown false", async () => {
    const tour = make({ steps: [{ title: "A" }] });
    await tour.start();
    const el = tour.steps[0]!.element;
    tour.hideCurrent();
    expect(tour.steps[0]!.isShown()).toBe(false);
    expect(tour.steps[0]!.element).toBe(el);
  });
});

describe("TourStep.configure", () => {
  it("replaces title, string body, label and buttons in place with the same wrapper and no events", async () => {
    const tour = make({ steps: [{ id: "a", title: "Old", body: "old body", buttons: [{ text: "Old btn", action: "forward" }] }, { title: "B" }] });
    await tour.start();
    const before = wrapper();
    const events: string[] = [];
    tour.steps[0]!.on("will-show", () => events.push("will-show"));
    tour.steps[0]!.on("shown", () => events.push("shown"));
    tour.steps[0]!.on("will-hide", () => events.push("will-hide"));
    tour.steps[0]!.on("hidden", () => events.push("hidden"));
    tour.on("step-shown", () => events.push("step-shown"));
    const button = before.querySelector(".vt-footer .vt-button");

    tour.stepById("a")!.configure({ title: "New", body: "new body", buttons: [{ text: "New btn", action: "forward" }, { text: "Extra", action: "exit" }] });

    expect(wrapper()).toBe(before);
    expect(text(".vt-popover-title")).toBe("New");
    expect(text(".vt-popover-description")).toBe("new body");
    expect(Array.from(before.querySelectorAll(".vt-footer .vt-button")).map((b) => b.textContent)).toEqual(["New btn", "Extra"]);
    expect(before.querySelector(".vt-footer .vt-button")).toBe(button);
    expect(events).toEqual([]);
    expect(tour.stepById("a")!.element).toBe(before);
  });

  it("switches an untitled step's accessible name between label and title", async () => {
    const tour = make({ steps: [{ id: "a", label: "Name" }] });
    await tour.start();
    expect(wrapper().getAttribute("aria-label")).toBe("Name");
    tour.stepById("a")!.configure({ title: "Title" });
    expect(wrapper().getAttribute("aria-labelledby")).toBe("vt-popover-title");
    expect(wrapper().hasAttribute("aria-label")).toBe(false);
  });

  it("switches between an Element body and a string body", async () => {
    const note = document.createElement("div");
    note.id = "note";
    note.textContent = "element body";
    const tour = make({ steps: [{ id: "a", title: "A", body: "text" }] });
    await tour.start();
    expect(wrapper().querySelector(".vt-body")).toBeNull();
    tour.stepById("a")!.configure({ body: note });
    expect(wrapper().querySelector(".vt-body #note")?.textContent).toBe("element body");
    expect(text(".vt-popover-description")).toBe("");
    expect(wrapper().getAttribute("aria-describedby")).toContain("vt-popover-body");
    tour.stepById("a")!.configure({ body: "text again" });
    expect(wrapper().querySelector(".vt-body")).toBeNull();
    expect(text(".vt-popover-description")).toBe("text again");
    expect(wrapper().getAttribute("aria-describedby")).toBe("vt-popover-description");
  });

  it("keeps an unchanged Element body mounted instead of cloning it again", async () => {
    const note = document.createElement("div");
    const tour = make({ steps: [{ id: "a", title: "A", body: note }] });
    await tour.start();
    const body = wrapper().querySelector(".vt-body");
    tour.stepById("a")!.configure({ title: "A2" });
    expect(wrapper().querySelector(".vt-body")).toBe(body);
  });

  it("updates classes, close button label and attrs, and the counter", async () => {
    const tour = make({ counter: (i, n) => `${i}/${n}`, steps: [{ id: "a", title: "A", classes: "one" }, { title: "B" }] });
    await tour.start();
    expect(wrapper().classList.contains("one")).toBe(true);
    tour.stepById("a")!.configure({ classes: ["two"], closeButton: { label: "Dismiss", attrs: { "data-x": "1" } } });
    expect(wrapper().classList.contains("one")).toBe(false);
    expect(wrapper().classList.contains("two")).toBe(true);
    expect(wrapper().querySelector(".vt-popover-close-btn")!.getAttribute("aria-label")).toBe("Dismiss");
    expect(wrapper().querySelector(".vt-popover-close-btn")!.getAttribute("data-x")).toBe("1");
    expect(text(".vt-popover-progress-text")).toBe("1/2");
  });

  it("hides the close button when closeButton becomes false and removes the footer when buttons become empty", async () => {
    const tour = make({ steps: [{ id: "a", title: "A", buttons: [{ text: "x", action: "forward" }] }] });
    await tour.start();
    tour.stepById("a")!.configure({ closeButton: false, buttons: [] });
    expect(wrapper().querySelector<HTMLElement>(".vt-popover-close-btn")!.style.display).toBe("none");
    expect(wrapper().querySelector(".vt-footer")).toBeNull();
  });

  it("keeps focus inside the popover when the focused button is replaced", async () => {
    const tour = make({ steps: [{ id: "a", title: "A", focus: "first-button", buttons: [{ text: "one", action: "forward" }] }] });
    await tour.start();
    const button = wrapper().querySelector<HTMLButtonElement>(".vt-footer .vt-button")!;
    expect(document.activeElement).toBe(button);
    tour.stepById("a")!.configure({ buttons: [{ text: "renamed", action: "forward" }] });
    expect(document.activeElement).toBe(button);
    expect(button.textContent).toBe("renamed");
    tour.stepById("a")!.configure({ buttons: [] });
    expect(wrapper().contains(document.activeElement)).toBe(true);
  });

  it("uses the new configuration on the next show when the step is not on screen", async () => {
    const tour = make({ steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
    tour.stepById("b")!.configure({ title: "B2" });
    await tour.start();
    await tour.forward();
    expect(text(".vt-popover-title")).toBe("B2");
    tour.stepById("a")!.configure({ title: "A2" });
    await tour.backward();
    expect(text(".vt-popover-title")).toBe("A2");
  });

  it("works before a run and after it ended", async () => {
    const tour = make({ steps: [{ id: "a", title: "A" }] });
    tour.stepById("a")!.configure({ title: "Before" });
    expect(tour.stepById("a")!.config.title).toBe("Before");
    await tour.start();
    expect(text(".vt-popover-title")).toBe("Before");
    tour.finish();
    tour.stepById("a")!.configure({ title: "After" });
    await tour.start();
    expect(text(".vt-popover-title")).toBe("After");
  });

  it("merges nested groups, ignores id, and replaces arrays", () => {
    const tour = make({ steps: [{ id: "a", position: { flip: false, shift: true }, buttons: [{ text: "x", action: "forward" }] }] });
    const step = tour.stepById("a")!;
    step.configure({ position: { shift: false }, id: "other", buttons: [{ text: "y", action: "exit" }] });
    expect(step.config.position).toMatchObject({ flip: false, shift: false });
    expect(step.id).toBe("a");
    expect(step.config.id).toBe("a");
    expect(step.config.title).toBeUndefined();
    expect(step.config.buttons).toHaveLength(1);
    expect(step.config.buttons![0]!.text).toBe("y");
  });

  it("a configure on a hidden step does not touch the screen", async () => {
    const tour = make({ steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
    await tour.start();
    tour.stepById("b")!.configure({ title: "changed" });
    expect(text(".vt-popover-title")).toBe("A");
  });

  it("every .vt-* element the engine and layer drew survives a configure", async () => {
    const note = document.createElement("div");
    const tour = make({ counter: true, steps: [{ id: "a", title: "A", body: note, buttons: [{ text: "x", action: "forward" }] }] });
    await tour.start();
    const collect = () => Array.from(wrapper().querySelectorAll("*")).filter((e) => Array.from(e.classList).some((c) => c.startsWith("vt-")));
    const before = collect();
    tour.stepById("a")!.configure({ title: "A2", body: note, buttons: [{ text: "y", action: "forward" }] });
    const after = collect();
    for (const element of before) expect(after).toContain(element);
  });

  it("layer parts carry no inline styles", async () => {
    const tour = make({ steps: [{ id: "a", title: "A", body: document.createElement("p"), buttons: [{ text: "x", action: "forward" }] }] });
    await tour.start();
    for (const element of wrapper().querySelectorAll(".vt-body, .vt-footer, .vt-footer .vt-button")) {
      expect(element.getAttribute("style")).toBeNull();
    }
  });
});
