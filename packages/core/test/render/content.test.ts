import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour, TourConfig } from "../../src/index";
import { compileStepForShow, compileTour } from "../../src/compile";
import { setCurrentTour } from "../../src/registry";
import { engineOf, normalizedConfigOf } from "../../src/tour";
import { resolveBody } from "../../src/render/content";

const created: Tour[] = [];

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function show(config: TourConfig): Promise<Tour> {
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  await tour.start();
  return tour;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover")!;
const description = () => document.querySelector<HTMLElement>(".vt-popover-description")!;
const body = () => document.querySelector<HTMLElement>(".vt-body");

describe("body types", () => {
  it("renders a string as the description", async () => {
    await show({ steps: [{ title: "T", body: "<b>bold</b> text" }] });
    expect(description().innerHTML).toBe("<b>bold</b> text");
    expect(description().style.display).toBe("");
    expect(body()).toBeNull();
  });

  it("renders a string array as one paragraph per entry", async () => {
    await show({ steps: [{ title: "T", body: ["one", "<i>two</i>", "three"] }] });
    const paragraphs = [...description().querySelectorAll("p")];
    expect(paragraphs.map((p) => p.innerHTML)).toEqual(["one", "<i>two</i>", "three"]);
    expect(body()).toBeNull();
  });

  it("moves an element into .vt-body after the description and repoints aria-describedby", async () => {
    const el = document.createElement("section");
    el.textContent = "custom";
    document.body.append(el);
    await show({ steps: [{ title: "T", body: el }] });
    const b = body()!;
    expect(b.contains(el)).toBe(true);
    expect(el.textContent).toBe("custom");
    expect(description().nextElementSibling).toBe(b);
    expect(wrapper().getAttribute("aria-describedby")).toBe(b.id);
    expect(document.querySelectorAll("section")).toHaveLength(1);
  });

  it("evaluates a function body at show time and handles each result type", async () => {
    const fn = vi.fn<() => string | string[] | Element>(() => "from fn");
    const tour = await show({ steps: [{ id: "a", title: "A", body: fn }, { id: "b", title: "B", body: fn }, { id: "c", title: "C", body: fn }] });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(description().innerHTML).toBe("from fn");

    fn.mockReturnValue(["p1", "p2"]);
    await tour.forward();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(description().querySelectorAll("p")).toHaveLength(2);

    const el = document.createElement("div");
    el.id = "made-late";
    fn.mockReturnValue(el);
    await tour.forward();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(body()!.contains(el)).toBe(true);
  });

  it("evaluates a function title at show time", async () => {
    const title = vi.fn(() => "Dynamic");
    await show({ steps: [{ title, body: "x" }] });
    expect(title).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".vt-popover-title")!.textContent).toBe("Dynamic");
  });

  it("does not evaluate function content when compiling the tour", () => {
    const fn = vi.fn(() => "x");
    const tour = createTour({ steps: [{ title: fn, body: fn }] });
    compileTour(normalizedConfigOf(tour), tour.steps);
    expect(fn).not.toHaveBeenCalled();
  });

  it("resolves bodies by type without touching the DOM", () => {
    expect(resolveBody("a", false, undefined)).toEqual({ description: "a" });
    expect(resolveBody(["a", "b"], false, undefined)).toEqual({ description: "<p>a</p><p>b</p>" });
    expect(resolveBody(() => "a", false, undefined)).toEqual({});
    expect(resolveBody(undefined, true, undefined)).toEqual({});
  });
});

describe("sanitize", () => {
  it("runs before the engine sees title and body HTML, once per string", async () => {
    const sanitize = vi.fn((html: string) => html.replace(/<script.*?<\/script>/g, "").toUpperCase());
    await show({
      sanitize,
      steps: [{ title: "ti<script>x</script>tle", body: "bo<script>y</script>dy" }],
    });
    expect(document.querySelector(".vt-popover-title")!.innerHTML).toBe("TITLE");
    expect(description().innerHTML).toBe("BODY");
    const calls = sanitize.mock.calls.map((c) => c[0]);
    expect(calls.sort()).toEqual(["bo<script>y</script>dy", "ti<script>x</script>tle"]);
  });

  it("sanitizes each paragraph of a string array once per compile pass", () => {
    const sanitize = vi.fn((html: string) => `[${html}]`);
    const tour = createTour({ sanitize, steps: [{ body: ["a", "b"] }] });
    const step = compileStepForShow(tour.steps[0]!, 5, sanitize);
    expect(step.popover?.description).toBe("<p>[a]</p><p>[b]</p>");
    expect(sanitize.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });

  it("is applied in compileTour and passes function results through at show time", async () => {
    const sanitize = vi.fn((html: string) => `<u>${html}</u>`);
    const tour = createTour({ sanitize, steps: [{ title: "static", body: () => "dyn" }] });
    const compiled = compileTour(normalizedConfigOf(tour), tour.steps);
    expect(compiled.steps[0]!.popover?.title).toBe("<u>static</u>");
    expect(compiled.steps[0]!.popover?.description).toBeUndefined();
    await tour.start();
    created.push(tour);
    expect(description().innerHTML).toBe("<u>dyn</u>");
    expect(engineOf(tour)).not.toBeNull();
  });

  it("clears the sanitizer memo between runs", async () => {
    const sanitize = vi.fn((html: string) => html);
    const tour = await show({ sanitize, steps: [{ title: "T", body: "same" }] });
    const first = sanitize.mock.calls.filter((c) => c[0] === "same").length;
    expect(first).toBeGreaterThan(0);
    tour.finish();
    await tour.start();
    expect(sanitize.mock.calls.filter((c) => c[0] === "same").length).toBe(first * 2);
  });

  it("does not sanitize an element body or the label", async () => {
    const sanitize = vi.fn((html: string) => html);
    const el = document.createElement("div");
    await show({ sanitize, steps: [{ label: "A label", body: el }] });
    expect(sanitize).not.toHaveBeenCalled();
    expect(wrapper().getAttribute("aria-label")).toBe("A label");
  });
});

describe("classes and meta", () => {
  it("joins classes into popoverClass so the wrapper carries them", async () => {
    await show({ steps: [{ title: "T", classes: ["one", "two"] }] });
    expect(wrapper().classList.contains("one")).toBe(true);
    expect(wrapper().classList.contains("two")).toBe(true);
  });

  it("accepts a class string and keeps meta reachable through the step without interpreting it", async () => {
    const tour = await show({ steps: [{ title: "T", classes: "solo", meta: { analyticsId: "s-1" } }] });
    expect(wrapper().classList.contains("solo")).toBe(true);
    expect(tour.steps[0]!.config.meta).toEqual({ analyticsId: "s-1" });
    expect(compileStepForShow(tour.steps[0]!).data).toEqual({ vt: tour.steps[0] });
  });
});

describe("accessible name through the tour", () => {
  it("titled step is labelled by its title, untitled step by its label", async () => {
    const tour = await show({ steps: [{ id: "a", title: "Titled" }, { id: "b", label: "Quiet step", body: "x" }] });
    expect(wrapper().getAttribute("aria-labelledby")).toBe("vt-popover-title");
    await tour.forward();
    expect(wrapper().getAttribute("aria-label")).toBe("Quiet step");
    expect(wrapper().hasAttribute("aria-labelledby")).toBe(false);
  });

  it("warns once per tour when a step has neither title nor label", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = await show({ steps: [{ id: "a", body: "x" }, { id: "b", body: "y" }] });
    await tour.forward();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('"a"');
  });

  it("does not warn for named steps", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await show({ steps: [{ title: "T" }] });
    expect(warn).not.toHaveBeenCalled();
  });
});
