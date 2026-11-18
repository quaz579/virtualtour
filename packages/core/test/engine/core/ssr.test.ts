// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createEngine } from "../../../src/engine/driver";

describe("server-side import", () => {
  it("has no DOM to lean on", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  it("constructs a driver and answers inert queries", () => {
    const d = createEngine({ steps: [{ element: "#a", popover: { title: "A" } }] });

    expect(d.isActive()).toBe(false);
    expect(d.getActiveIndex()).toBeUndefined();
    expect(d.getActiveStep()).toBeUndefined();
    expect(d.hasNextStep()).toBe(false);
    expect(d.getConfig().steps).toHaveLength(1);
    expect(() => d.setSteps([])).not.toThrow();
    expect(() => d.setConfig({ animate: false })).not.toThrow();
    expect(() => d.moveNext()).not.toThrow();
    expect(() => d.destroy()).not.toThrow();
  });
});
