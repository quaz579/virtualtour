import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../src/index";
import type { Tour, TourConfig } from "../src/index";
import { patchStepConfig } from "../src/config";
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

describe("patchStepConfig", () => {
  it("removes a cleared key that has no default", () => {
    const out = patchStepConfig({ id: "a", title: "T", waitFor: 5 }, { title: null }, {});
    expect("title" in out).toBe(false);
    expect(out.waitFor).toBe(5);
  });

  it("restores a cleared key to its default", () => {
    const out = patchStepConfig({ whenMissing: "skip", reveal: false }, { whenMissing: null, reveal: null }, { whenMissing: "center", reveal: true });
    expect(out.whenMissing).toBe("center");
    expect(out.reveal).toBe(true);
  });

  it("clears single keys inside nested groups and keeps their siblings", () => {
    const out = patchStepConfig(
      { position: { flip: false, shift: false, offset: { main: 4, cross: 2 } }, extensions: { a: 1, b: 2 } },
      { position: { flip: null, offset: { cross: null } }, extensions: { a: null } },
      { position: { flip: true, offset: { main: 1, cross: 0 } } }
    );
    expect(out.position).toEqual({ flip: true, shift: false, offset: { main: 4, cross: 0 } });
    expect(out.extensions).toEqual({ b: 2 });
  });

  it("clears whole groups", () => {
    const out = patchStepConfig(
      { position: { flip: false }, spotlight: { padding: 4 }, closeButton: false, extensions: { a: 1 } },
      { position: null, spotlight: null, closeButton: null, extensions: null },
      { position: { flip: true }, spotlight: { extra: [] }, closeButton: true }
    );
    expect(out).toEqual({ position: { flip: true }, spotlight: { extra: [] }, closeButton: true });
  });

  it("clears hooks, buttons, and every other key", () => {
    const fn = () => true;
    const hook = () => undefined;
    const base = {
      shouldShow: fn,
      prepare: fn,
      revealWith: hook,
      buttons: [{ text: "x", action: "forward" as const }],
      autoAdvance: { event: "click" },
      instruction: "do it",
      advanceDelay: 3,
      hookTimeout: 5,
      waitFor: 1,
      target: "#a",
      placement: "auto" as const,
      meta: { a: 1 },
      focus: "first-button" as const,
      classes: "x",
      label: "l",
      body: "b",
    };
    const patch = Object.fromEntries(Object.keys(base).map((key) => [key, null]));
    expect(patchStepConfig(base, patch as never, {})).toEqual({});
  });

  it("ignores undefined and id, never mutates its inputs, and shares nothing with defaults", () => {
    const base = { id: "a", title: "T", position: { flip: false } };
    const defaults = { spotlight: { extra: ["x"] } };
    const out = patchStepConfig(base, { id: "z", title: undefined, spotlight: null } as never, defaults);
    expect(out.id).toBe("a");
    expect(out.title).toBe("T");
    expect(out.spotlight).toEqual({ extra: ["x"] });
    expect(out.spotlight).not.toBe(defaults.spotlight);
    expect(out.spotlight!.extra).not.toBe(defaults.spotlight.extra);
    expect(base).toEqual({ id: "a", title: "T", position: { flip: false } });
  });

  it("drops unsafe keys", () => {
    const patch = JSON.parse('{"position":{"__proto__":{"polluted":true}}}');
    patchStepConfig({ position: { flip: true } }, patch, {});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("TourStep.configure with null", () => {
  it("restores a field to the tour's stepDefaults value, not the built-in one", () => {
    const tour = make({ stepDefaults: { whenMissing: "skip", position: { flip: false } }, steps: [{ id: "a", whenMissing: "center", position: { flip: true, shift: false } }] });
    const step = tour.stepById("a")!;
    step.configure({ whenMissing: null, position: { flip: null } });
    expect(step.config.whenMissing).toBe("skip");
    expect(step.config.position).toMatchObject({ flip: false, shift: false });
  });

  it("falls back to the built-in default when the tour sets none", () => {
    const tour = make({ steps: [{ id: "a", closeButton: false, position: { shift: false } }] });
    const step = tour.stepById("a")!;
    step.configure({ closeButton: null, position: { shift: null } });
    expect(step.config.closeButton).toBe(true);
    expect(step.config.position?.shift).toBe(true);
  });

  it("clears title, body, label, classes, buttons and the close label on a shown step", async () => {
    const tour = make({
      steps: [
        {
          id: "a",
          title: "T",
          body: "B",
          label: "L",
          classes: "extra",
          closeButton: { label: "Shut" },
          buttons: [{ text: "Go", action: "forward" }],
        },
        { title: "Second" },
      ],
    });
    await tour.start();
    expect(text(".vt-popover-title")).toBe("T");
    expect(wrapper().classList.contains("extra")).toBe(true);
    expect(wrapper().querySelectorAll(".vt-footer .vt-button").length).toBe(1);

    tour.stepById("a")!.configure({ title: null, body: null, label: null, classes: null, closeButton: { label: null }, buttons: null });

    expect(text(".vt-popover-title") ?? "").toBe("");
    expect(text(".vt-popover-description") ?? "").toBe("");
    expect(wrapper().classList.contains("extra")).toBe(false);
    expect(wrapper().getAttribute("aria-label")).toBeNull();
    const labels = Array.from(wrapper().querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).not.toContain("Go");
    expect(labels).not.toContain("Shut");
    expect(labels).toContain("Next");
  });

  it("clearing a body element removes it from the shown popover", async () => {
    const note = document.createElement("div");
    note.className = "note";
    const tour = make({ steps: [{ id: "a", title: "T", body: note }] });
    await tour.start();
    expect(wrapper().querySelector(".note")).not.toBeNull();
    tour.stepById("a")!.configure({ body: null });
    expect(wrapper().querySelector(".note")).toBeNull();
  });

  it("clearing an instruction hides its row on the shown step and leaves the config without it", async () => {
    const tour = make({ steps: [{ id: "a", title: "A", instruction: "Click the thing" }, { id: "b", title: "B" }] });
    await tour.start();
    const row = () => wrapper().querySelector<HTMLElement>(".vt-popover-instruction")!;
    expect(row().style.display).not.toBe("none");
    tour.stepById("a")!.configure({ instruction: null });
    expect(row().style.display).toBe("none");
    expect(tour.stepById("a")!.config.instruction).toBeUndefined();
  });

  it("clears hooks so the next navigation no longer calls them", async () => {
    const shouldShow = vi.fn(() => false);
    const prepare = vi.fn();
    const tour = make({ steps: [{ id: "a", title: "A" }, { id: "b", title: "B", shouldShow, prepare }, { id: "c", title: "C" }] });
    tour.stepById("b")!.configure({ shouldShow: null, prepare: null });
    await tour.start();
    await tour.forward();
    expect(tour.currentStep?.id).toBe("b");
    expect(shouldShow).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("clears a target so the step shows centered on its next show", async () => {
    document.body.innerHTML = '<button id="t">t</button>';
    const tour = make({ steps: [{ id: "a", title: "A", target: "#t" }, { id: "b", title: "B" }] });
    await tour.start();
    expect(tour.currentStep?.resolvedTarget).not.toBeNull();
    const step = tour.stepById("a")!;
    step.configure({ target: null });
    expect(step.config.target).toBeUndefined();
    await tour.forward();
    await tour.backward();
    expect(tour.currentStep?.resolvedTarget).toBeNull();
  });

  it("clears autoAdvance and advanceDelay", () => {
    const tour = make({ steps: [{ id: "a", autoAdvance: { event: "click" }, advanceDelay: 50, waitFor: 10, hookTimeout: 1 }] });
    const step = tour.stepById("a")!;
    step.configure({ autoAdvance: null, advanceDelay: null, waitFor: null, hookTimeout: null });
    expect(step.config.autoAdvance).toBeUndefined();
    expect(step.config.advanceDelay).toBeUndefined();
    expect(step.config.waitFor).toBeUndefined();
    expect(step.config.hookTimeout).toBeUndefined();
  });

  it("null on id is ignored", () => {
    const tour = make({ steps: [{ id: "a" }] });
    tour.stepById("a")!.configure({ id: null } as never);
    expect(tour.stepById("a")!.config.id).toBe("a");
  });

  it("a plain configure after a clear sets the field again", async () => {
    const tour = make({ steps: [{ id: "a", title: "T" }] });
    await tour.start();
    const step = tour.stepById("a")!;
    step.configure({ title: null });
    step.configure({ title: "Back" });
    expect(text(".vt-popover-title")).toBe("Back");
  });
});
