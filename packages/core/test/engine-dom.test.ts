import { afterEach, describe, expect, it } from "vitest";
import { createEngine } from "../src/engine/driver";

describe("unit-dom harness", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("provides a DOM", () => {
    expect(typeof window).toBe("object");
    expect(document.body).toBeTruthy();
  });

  it("drives a one-step tour and renders a popover", () => {
    document.body.innerHTML = '<button id="one">One</button>';
    const engine = createEngine({
      animate: false,
      steps: [{ element: "#one", popover: { title: "One", description: "First" } }],
    });
    engine.drive();
    expect(document.querySelector(".vt-popover-title")?.textContent).toBe("One");
    engine.destroy();
    expect(document.querySelector(".vt-popover")).toBeNull();
  });
});
