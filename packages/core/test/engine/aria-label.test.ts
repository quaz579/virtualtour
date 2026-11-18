import { describe, expect, it } from "vitest";
import { createDriver, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

const titleEl = () => document.querySelector<HTMLElement>(".vt-popover-title");

describe("accessible name", () => {
  it("names the dialog by its title with aria-labelledby and no aria-label", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Hello", label: "ignored" } });
    const el = popoverEl()!;
    expect(el.getAttribute("aria-labelledby")).toBe("vt-popover-title");
    expect(el.hasAttribute("aria-label")).toBe(false);
  });

  it("uses label as aria-label when there is no title", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { description: "Body", label: "Welcome" } });
    const el = popoverEl()!;
    expect(el.getAttribute("aria-label")).toBe("Welcome");
    expect(el.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("leaves the dialog unnamed with neither title nor label", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { description: "Body" } });
    const el = popoverEl()!;
    expect(el.hasAttribute("aria-label")).toBe(false);
    expect(el.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("switches between title and label at runtime through updatePopover", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Hello", description: "Body" } });
    const el = popoverEl()!;
    expect(el.getAttribute("aria-labelledby")).toBe("vt-popover-title");

    d.updatePopover({ title: "", label: "x" });
    expect(el.hasAttribute("aria-labelledby")).toBe(false);
    expect(el.getAttribute("aria-label")).toBe("x");

    d.updatePopover({ title: "Back" });
    expect(el.getAttribute("aria-labelledby")).toBe("vt-popover-title");
    expect(el.hasAttribute("aria-label")).toBe(false);
  });

  it("starts with empty placeholder texts and clears the title text when it is hidden", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { label: "Only a label" } });
    expect(titleEl()!.textContent).toBe("");
    expect(titleEl()!.style.display).toBe("none");
    expect(document.querySelector(".vt-popover-description")!.textContent).toBe("");

    d.updatePopover({ title: "Shown" });
    expect(titleEl()!.textContent).toBe("Shown");
    d.updatePopover({ title: "" });
    expect(titleEl()!.textContent).toBe("");
    expect(titleEl()!.style.display).toBe("none");
  });
});
