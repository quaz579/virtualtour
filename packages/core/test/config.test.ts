import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIM,
  DEFAULT_STEP_CONFIG,
  makeTourId,
  mergeStepConfig,
  normalizeTourConfig,
  resolveStepConfig,
} from "../src/config";
import type { StepConfig } from "../src/types";

describe("mergeStepConfig", () => {
  it("keeps unspecified keys when merging nested position", () => {
    const merged = mergeStepConfig(
      { position: { offset: { main: 4, cross: 2 }, flip: false, shift: false } },
      { position: { shift: true } }
    );
    expect(merged.position).toEqual({ offset: { main: 4, cross: 2 }, flip: false, shift: true });
  });

  it("merges position.offset object form key by key", () => {
    const merged = mergeStepConfig({ position: { offset: { main: 4, cross: 2 } } }, { position: { offset: { cross: 9 } } });
    expect(merged.position?.offset).toEqual({ main: 4, cross: 9 });
  });

  it("a number replaces an object offset and the reverse", () => {
    expect(mergeStepConfig({ position: { offset: { main: 4 } } }, { position: { offset: 8 } }).position?.offset).toBe(8);
    expect(mergeStepConfig({ position: { offset: 8 } }, { position: { offset: { cross: 1 } } }).position?.offset).toEqual({
      cross: 1,
    });
  });

  it("merges spotlight.radius per corner", () => {
    const merged = mergeStepConfig(
      { spotlight: { radius: { topLeft: 4, topRight: 6 } } },
      { spotlight: { radius: { topRight: 8, bottomLeft: 2 } } }
    );
    expect(merged.spotlight?.radius).toEqual({ topLeft: 4, topRight: 8, bottomLeft: 2 });
  });

  it("merges closeButton object form and lets a boolean replace it", () => {
    expect(
      mergeStepConfig({ closeButton: { label: "Shut", attrs: { a: "1" } } }, { closeButton: { attrs: { b: "2" } } }).closeButton
    ).toEqual({ label: "Shut", attrs: { a: "1", b: "2" } });
    expect(mergeStepConfig({ closeButton: { label: "Shut" } }, { closeButton: false }).closeButton).toBe(false);
  });

  it("merges extensions recursively", () => {
    const merged = mergeStepConfig(
      { extensions: { avatar: { animation: "wave", speed: 1 }, other: { x: 1 } } },
      { extensions: { avatar: { animation: "point.left" } } }
    );
    expect(merged.extensions).toEqual({ avatar: { animation: "point.left", speed: 1 }, other: { x: 1 } });
  });

  it("replaces arrays", () => {
    const merged = mergeStepConfig(
      { spotlight: { extra: ["#a", "#b"] }, classes: ["x", "y"], buttons: [{ text: "A", action: "forward" }] },
      { spotlight: { extra: ["#c"] }, classes: ["z"], buttons: [{ text: "B", action: "exit" }] }
    );
    expect(merged.spotlight?.extra).toEqual(["#c"]);
    expect(merged.classes).toEqual(["z"]);
    expect(merged.buttons).toEqual([{ text: "B", action: "exit" }]);
  });

  it("replaces functions", () => {
    const first = () => "first";
    const second = () => "second";
    expect(mergeStepConfig({ title: first, shouldShow: () => true }, { title: second }).title).toBe(second);
  });

  it("replaces DOM elements by reference", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    const merged = mergeStepConfig({ target: a }, { target: b });
    expect(merged.target).toBe(b);
    expect(mergeStepConfig({ target: a }, {}).target).toBe(a);
  });

  it("keeps the base value when the patch value is undefined", () => {
    const patch = { title: undefined, position: { flip: undefined } } as unknown as Partial<StepConfig>;
    const merged = mergeStepConfig({ title: "Keep", position: { flip: false } }, patch);
    expect(merged.title).toBe("Keep");
    expect(merged.position?.flip).toBe(false);
  });

  it("does not modify its inputs or share nested objects with them", () => {
    const base: Partial<StepConfig> = { position: { offset: { main: 1 } }, spotlight: { extra: ["#a"] } };
    const patch: Partial<StepConfig> = { position: { offset: { cross: 2 } } };
    const snapshot = JSON.parse(JSON.stringify({ base, patch }));
    const merged = mergeStepConfig(base, patch);
    (merged.position?.offset as { main: number }).main = 99;
    merged.spotlight?.extra?.push("#b");
    expect({ base, patch }).toEqual(snapshot);
  });

  it("ignores prototype-polluting keys", () => {
    const patch = JSON.parse('{"__proto__":{"polluted":true},"position":{"__proto__":{"polluted":true}}}');
    const merged = mergeStepConfig({}, patch);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((merged as Record<string, unknown>).polluted).toBeUndefined();
    expect((merged.position as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("makeTourId", () => {
  it("feeds the name into the id as a slug", () => {
    expect(makeTourId("Billing Introduction!")).toMatch(/^billing-introduction-[a-z0-9]+$/);
  });

  it("falls back to tour when the name is missing or has no usable characters", () => {
    expect(makeTourId()).toMatch(/^tour-[a-z0-9]+$/);
    expect(makeTourId("***")).toMatch(/^tour-[a-z0-9]+$/);
  });

  it("is unique across 10000 calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10000; i += 1) ids.add(makeTourId("same"));
    expect(ids.size).toBe(10000);
  });
});

describe("normalizeTourConfig", () => {
  it("applies the documented defaults", () => {
    const n = normalizeTourConfig({});
    expect(n.namespace).toBe("vt");
    expect(n.keys).toEqual({ escape: true, arrows: true });
    expect(n.exitPrompt).toBe(false);
    expect(n.dim).toBe(false);
    expect(n.counter).toBe(false);
    expect(n.animate).toBe(true);
    expect(n.labels).toEqual({ next: "Next", back: "Back", done: "Done", close: "Close" });
    expect(n.steps).toEqual([]);
    expect(n.dimOptions).toEqual(DEFAULT_DIM);
    expect(n.stepDefaults).toEqual({
      whenMissing: "center",
      closeButton: true,
      focus: "dialog",
      reveal: true,
      position: {
        offset: { main: 10, cross: 0 },
        viewportPadding: 0,
        flip: true,
        shift: true,
        strategy: "fixed",
        arrow: { minInset: 15 },
      },
      spotlight: { extra: [], targetInteractive: true },
    });
    expect(DEFAULT_DIM).toEqual({
      padding: 10,
      radius: 5,
      transitionMs: 400,
      color: "#000",
      opacity: 0.7,
      clickOutside: "none",
      pageScroll: true,
      lockScrollParent: false,
      clipToScrollParents: true,
    });
  });

  it("uses the name for the id and keeps an explicit id", () => {
    expect(normalizeTourConfig({ name: "Intro" }).id).toMatch(/^intro-/);
    expect(normalizeTourConfig({ id: "fixed" }).id).toBe("fixed");
  });

  it("merges keys and labels over their defaults", () => {
    const n = normalizeTourConfig({ keys: { escape: false }, labels: { done: "Finish" } });
    expect(n.keys).toEqual({ escape: false, arrows: true });
    expect(n.labels).toEqual({ next: "Next", back: "Back", done: "Finish", close: "Close" });
  });

  it("dim true uses the defaults and enables the overlay", () => {
    const n = normalizeTourConfig({ dim: true });
    expect(n.dim).toBe(true);
    expect(n.dimOptions).toEqual(DEFAULT_DIM);
  });

  it("dim false and absent leave the overlay off", () => {
    expect(normalizeTourConfig({ dim: false }).dim).toBe(false);
    expect(normalizeTourConfig({}).dim).toBe(false);
  });

  it("dim object merges over the defaults", () => {
    const n = normalizeTourConfig({ dim: { padding: 3, clickOutside: "exit" } });
    expect(n.dim).toBe(true);
    expect(n.dimOptions).toEqual({ ...DEFAULT_DIM, padding: 3, clickOutside: "exit" });
  });

  it("dim radius in corner form fills missing corners with the default radius", () => {
    const n = normalizeTourConfig({ dim: { radius: { topLeft: 0 } } });
    expect(n.dimOptions.radius).toEqual({ topLeft: 0, topRight: 5, bottomRight: 5, bottomLeft: 5 });
  });

  it("merges stepDefaults over the built-in step defaults", () => {
    const n = normalizeTourConfig({ stepDefaults: { position: { flip: false }, focus: "first-button" } });
    expect(n.stepDefaults.position).toEqual({ ...DEFAULT_STEP_CONFIG.position, flip: false });
    expect(n.stepDefaults.focus).toBe("first-button");
  });

  it("resolveStepConfig merges a step over the tour step defaults", () => {
    const n = normalizeTourConfig({ stepDefaults: { classes: ["base"], position: { shift: false } } });
    const resolved = resolveStepConfig(n, { classes: ["own"], position: { flip: false } });
    expect(resolved.classes).toEqual(["own"]);
    expect(resolved.position).toMatchObject({ shift: false, flip: false, strategy: "fixed" });
  });

  it("does not let a result share default arrays or objects", () => {
    const first = normalizeTourConfig({});
    first.stepDefaults.spotlight?.extra?.push("#x");
    (first.stepDefaults.position?.offset as { main: number }).main = 99;
    const second = normalizeTourConfig({});
    expect(second.stepDefaults.spotlight?.extra).toEqual([]);
    expect(second.stepDefaults.position?.offset).toEqual({ main: 10, cross: 0 });
  });

  it("copies the steps array", () => {
    const steps: StepConfig[] = [{ title: "a" }];
    const n = normalizeTourConfig({ steps });
    steps.push({ title: "b" });
    expect(n.steps).toHaveLength(1);
  });

  it("passes mountIn, dimMountIn, sanitize, counter, exitPrompt and animate through", () => {
    const mount = document.createElement("div");
    const dimMount = () => document.createElement("div");
    const sanitize = (html: string) => html;
    const counter = () => "x";
    const n = normalizeTourConfig({ mountIn: mount, dimMountIn: dimMount, sanitize, counter, exitPrompt: "Leave?", animate: false });
    expect(n.mountIn).toBe(mount);
    expect(n.dimMountIn).toBe(dimMount);
    expect(n.sanitize).toBe(sanitize);
    expect(n.counter).toBe(counter);
    expect(n.exitPrompt).toBe("Leave?");
    expect(n.animate).toBe(false);
  });

  it.each(["", "1abc", "a b", "a.b", "-x", "a/b", "ünï"])("throws on the invalid namespace %j", (namespace) => {
    expect(() => normalizeTourConfig({ namespace })).toThrow(/namespace/i);
  });

  it("throws on a non-string namespace", () => {
    expect(() => normalizeTourConfig({ namespace: 5 as unknown as string })).toThrow(/namespace/i);
  });

  it.each(["vt", "acme", "A1", "my-tour", "my_tour", "a"])("accepts the namespace %j", (namespace) => {
    expect(normalizeTourConfig({ namespace }).namespace).toBe(namespace);
  });
});
