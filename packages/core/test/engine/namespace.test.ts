import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { names } from "../../src/engine/core/namespace";
import { createDriver, SAMPLE_STEPS, useDriverHarness } from "./utils";

const SRC = resolve(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("names", () => {
  it("defaults to the vt namespace", () => {
    expect(names()).toEqual(names("vt"));
  });

  it("builds every prefixed name from the namespace", () => {
    const n = names("tour2");
    expect({
      active: n.active,
      fade: n.fade,
      simple: n.simple,
      noScroll: n.noScroll,
      target: n.target,
      targetBlocked: n.targetBlocked,
      targetRaised: n.targetRaised,
      extra: n.extra,
      targetParent: n.targetParent,
      overlay: n.overlay,
      overlayAnimated: n.overlayAnimated,
      stepAttr: n.stepAttr,
      sideAttr: n.sideAttr,
    }).toEqual({
      active: "tour2-active",
      fade: "tour2-fade",
      simple: "tour2-simple",
      noScroll: "tour2-no-scroll",
      target: "tour2-target",
      targetBlocked: "tour2-target-blocked",
      targetRaised: "tour2-target-raised",
      extra: "tour2-extra",
      targetParent: "tour2-target-parent",
      overlay: "tour2-overlay",
      overlayAnimated: "tour2-overlay-animated",
      stepAttr: "data-tour2-step",
      sideAttr: "data-tour2-side",
    });
  });

  it("builds the default vt names", () => {
    const n = names("vt");
    expect([n.active, n.target, n.targetBlocked, n.stepAttr]).toEqual([
      "vt-active",
      "vt-target",
      "vt-target-blocked",
      "data-vt-step",
    ]);
  });

  it("keeps mechanism attributes, popover classes and ids fixed whatever the namespace", () => {
    const n = names("tour2");
    expect(n.attr).toEqual({
      active: "data-vt-active",
      dim: "data-vt-dim",
      fade: "data-vt-fade",
      target: "data-vt-target",
      blocked: "data-vt-blocked",
      raised: "data-vt-raised",
      extra: "data-vt-extra",
      targetParent: "data-vt-target-parent",
      lockScroll: "data-vt-lock-scroll",
      overlay: "data-vt-overlay",
      layer: "data-vt-layer",
    });
    expect(n.popover.root).toBe("vt-popover");
    expect(n.popover.contentId).toBe("vt-popover-content");
    expect(n.popover.titleId).toBe("vt-popover-title");
    expect(n.popover.descriptionId).toBe("vt-popover-description");
    expect(n.popover.sideClass("top")).toBe("vt-popover-side-top");
    expect(n.layer).toBe("vt-layer");
    expect(n.animationDurationVar).toBe("--vt-animation-duration");
    expect(n.nudgeDurationVar).toBe("--vt-nudge-duration");
  });

  it("is frozen", () => {
    expect(Object.isFrozen(names("abc"))).toBe(true);
    expect(Object.isFrozen(names("abc").attr)).toBe(true);
  });

  it.each(["", "1abc", "-abc", "a b", "a.b", "a:b"])("rejects the namespace %j", ns => {
    expect(() => names(ns)).toThrow(/namespace/i);
  });

  it("rejects an invalid namespace when the engine is created", () => {
    expect(() => createDriver({ namespace: "9lives" })).toThrow(/namespace/i);
  });
});

describe("namespaced engines", () => {
  useDriverHarness();

  const leftovers = (prefix: string) =>
    [document.body, ...Array.from(document.body.querySelectorAll("*"))].flatMap(element =>
      [...element.classList].filter(name => name.startsWith(`${prefix}-`))
    );

  it("styles the page with the configured namespace", async () => {
    const d = createDriver({ animate: false, namespace: "abc", steps: SAMPLE_STEPS });
    d.drive();

    expect(document.body.classList.contains("abc-active")).toBe(true);
    expect(document.body.classList.contains("vt-active")).toBe(false);
    expect(document.querySelector("#intro")?.classList.contains("abc-target")).toBe(true);
    expect(document.querySelector("#intro")?.hasAttribute("data-vt-target")).toBe(true);
    expect(document.querySelector(".vt-popover")?.getAttribute("data-abc-step")).toBe("0");
    await vi.waitFor(() => expect(document.querySelector(".abc-overlay")?.hasAttribute("data-vt-overlay")).toBe(true));
    expect(document.body.hasAttribute("data-vt-active")).toBe(true);
    expect(document.body.hasAttribute("data-vt-dim")).toBe(true);
  });

  it("records the popover side under the namespace", () => {
    const d = createDriver({ animate: false, namespace: "abc", steps: SAMPLE_STEPS });
    d.drive();

    expect(document.querySelector(".vt-popover")?.getAttribute("data-abc-side")).toMatch(/^(top|right|bottom|left)$/);
  });

  it("leaves nothing behind once an engine with another namespace takes over", () => {
    const first = createDriver({ animate: false, namespace: "one", steps: SAMPLE_STEPS });
    first.drive();
    first.destroy();
    expect(leftovers("one")).toEqual([]);

    const second = createDriver({ animate: false, namespace: "two", steps: SAMPLE_STEPS });
    second.drive();
    expect(leftovers("one")).toEqual([]);
    expect(leftovers("two")).toContain("two-target");

    second.destroy();
    expect(leftovers("two")).toEqual([]);
    expect(document.body.hasAttribute("data-vt-active")).toBe(false);
  });

  it("clears the first namespace when a second engine starts without destroying the first", () => {
    const first = createDriver({ animate: false, namespace: "one", steps: SAMPLE_STEPS });
    first.drive();

    const second = createDriver({ animate: false, namespace: "two", steps: SAMPLE_STEPS });
    second.drive();

    expect(leftovers("one")).toEqual([]);
    expect(leftovers("two")).toContain("two-active");
  });
});

describe("source hygiene", () => {
  const files = sourceFiles(SRC).filter(file => file.endsWith(".ts") || file.endsWith(".css"));

  it("has no driver- literal anywhere under src", () => {
    const offenders = files.filter(file => readFileSync(file, "utf8").includes("driver-"));
    expect(offenders.map(file => relative(SRC, file))).toEqual([]);
  });

  it("builds no class name by concatenation outside namespace.ts", () => {
    const pattern = /classList\.(?:add|remove|toggle|contains)\(([^)]*)\)/g;
    const offenders: string[] = [];
    files
      .filter(file => file.endsWith(".ts") && !file.endsWith("namespace.ts"))
      .forEach(file => {
        for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
          if (/["'`][^"'`]*-/.test(match[1] ?? "")) {
            offenders.push(`${relative(SRC, file)}: ${match[0]}`);
          }
        }
      });
    expect(offenders).toEqual([]);
  });
});

describe("engine.css", () => {
  it("keys the pointer-events gate on data-vt-active and data-vt-dim", () => {
    const css = readFileSync(resolve(SRC, "engine/styles/engine.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const gates = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, body]) => /(^|;|\s)pointer-events:\s*none\s*;/.test(body ?? "") && selector?.includes(":where("))
      .map(([, selector]) => selector!.replace(/\s+/g, " ").trim());

    expect(gates).toHaveLength(1);
    expect(gates[0]).toBe(
      "[data-vt-active][data-vt-dim] :where(:not([data-vt-target], [data-vt-target] *, [data-vt-extra], [data-vt-extra] *, .vt-popover, .vt-popover *))"
    );
  });

  it("references no namespaced styling class", () => {
    const css = readFileSync(resolve(SRC, "engine/styles/engine.css"), "utf8");
    expect(css).not.toMatch(/\.vt-(active|fade|simple|no-scroll|target|extra|overlay)\b/);
  });
});
