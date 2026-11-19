import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour, TourConfig } from "../../src/index";
import { setCurrentTour } from "../../src/registry";
import { engineOf } from "../../src/tour";
import { applyAttrs, guardAttrs, mountBody } from "../../src/render/parts";

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

const close = () => document.querySelector<HTMLButtonElement>(".vt-popover-close-btn")!;

describe("attribute guard", () => {
  it("drops protected keys, on* handlers and style", () => {
    const kept = guardAttrs({
      type: "submit",
      class: "x",
      id: "y",
      "aria-label": "z",
      onclick: "alert(1)",
      OnMouseOver: "alert(2)",
      style: "color:red",
      "data-track": "close",
      title: "Close it",
    });
    expect(kept).toEqual({ "data-track": "close", title: "Close it" });
  });

  it.each(["hidden", "disabled", "tabindex", "aria-hidden", "role", "aria-labelledby", "aria-describedby", "form", "formaction"])(
    "drops %s",
    (name) => {
      expect(guardAttrs({ [name]: "x", [name.toUpperCase()]: "y", "data-ok": "1" })).toEqual({ "data-ok": "1" });
    }
  );

  it("returns nothing for missing attrs", () => {
    expect(guardAttrs(undefined)).toEqual({});
  });

  it("skips names the DOM rejects", () => {
    const el = document.createElement("button");
    expect(() => applyAttrs(el, { "bad name": "x", "data-ok": "1" })).not.toThrow();
    expect(el.getAttribute("data-ok")).toBe("1");
  });
});

describe("close button", () => {
  it("applies guarded attrs and keeps the engine's own type, class and label", async () => {
    await show({
      steps: [
        {
          title: "T",
          closeButton: {
            label: "Dismiss",
            attrs: { "data-track": "close", onclick: "window.hacked = 1", style: "display:none", class: "evil", id: "evil", type: "submit" },
          },
        },
      ],
    });
    const button = close();
    expect(button.getAttribute("data-track")).toBe("close");
    expect(button.hasAttribute("onclick")).toBe(false);
    expect(button.hasAttribute("style")).toBe(false);
    expect(button.id).toBe("");
    expect(button.classList.contains("evil")).toBe(false);
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Dismiss");
  });

  it("is hidden when closeButton is false", async () => {
    await show({ steps: [{ title: "T", closeButton: false }] });
    expect(close().style.display).toBe("none");
  });
});

describe("layer parts next to engine parts", () => {
  it("updatePopover after mount keeps every .vt-* element and adds no inline style to layer parts", async () => {
    const el = document.createElement("div");
    el.textContent = "custom";
    const tour = await show({ steps: [{ title: "T", body: el, classes: "extra" }] });
    const wrapper = document.querySelector<HTMLElement>(".vt-popover")!;
    const before = [...wrapper.querySelectorAll("*")].map((n) => n.className);
    engineOf(tour)!.updatePopover({ title: "New title", description: "hi", progressText: "x" });
    const after = [...wrapper.querySelectorAll("*")].map((n) => n.className);
    for (const cls of before) expect(after).toContain(cls);
    expect(wrapper.classList.contains("vt-dialog")).toBe(true);
    const body = wrapper.querySelector<HTMLElement>(".vt-body")!;
    expect(body.textContent).toBe("custom");
    expect(body.hasAttribute("style")).toBe(false);
    expect(wrapper.getAttribute("aria-describedby")).toContain(body.id);
    expect(wrapper.querySelector(".vt-popover-title")!.textContent).toBe("New title");
  });

  it("mounts the content again on a later show and leaves the engine's elements untouched", async () => {
    const el = document.createElement("div");
    const tour = await show({ steps: [{ id: "a", title: "A", body: el }, { id: "b", title: "B", body: "plain" }] });
    expect(document.querySelectorAll(".vt-body")).toHaveLength(1);
    await tour.forward();
    expect(document.querySelectorAll(".vt-body")).toHaveLength(0);
    expect(document.querySelector(".vt-popover-description")!.innerHTML).toBe("plain");
    await tour.backward();
    expect(document.querySelector(".vt-body")!.querySelector("div")).not.toBeNull();
  });

  it("warns instead of throwing when the body cannot be mounted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Element.prototype, "after").mockImplementation(() => {
      throw new DOMException("no", "HierarchyRequestError");
    });
    const tour = await show({ steps: [{ title: "T", body: document.createElement("p") }] });
    expect(tour.isRunning()).toBe(true);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("could not be mounted"))).toBe(true);
  });

  it("mountBody keeps other described-by tokens", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("aria-describedby", "vt-popover-description other");
    const description = document.createElement("div");
    wrapper.append(description);
    const body = mountBody({ wrapper, description } as never, document.createElement("p"));
    expect(wrapper.getAttribute("aria-describedby")).toBe(`${body.id} other`);
  });
});
