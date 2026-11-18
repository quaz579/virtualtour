import { describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, useDriverHarness } from "./utils";

useDriverHarness();

const STEPS = [{ element: "#intro", popover: { title: "Step 1" } }];

function container(id: string) {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

describe("mountIn / dimMountIn", () => {
  it("mounts the popover inside mountIn", async () => {
    const app = container("app");
    createDriver({ animate: false, steps: STEPS, mountIn: app }).drive();
    await nextFrame();

    expect(document.querySelector(".vt-popover")?.parentElement).toBe(app);
    expect(document.querySelector("[data-vt-overlay]")?.parentElement).toBe(document.body);
  });

  it("mounts the overlay inside dimMountIn, underneath its other children", async () => {
    const dim = container("dim");
    dim.appendChild(document.createElement("span"));
    createDriver({ animate: false, steps: STEPS, dimMountIn: dim }).drive();
    await nextFrame();

    expect(document.querySelector("[data-vt-overlay]")?.parentElement).toBe(dim);
    expect(dim.firstElementChild?.hasAttribute("data-vt-overlay")).toBe(true);
    expect(document.querySelector(".vt-popover")?.parentElement).toBe(document.body);
  });

  it("calls the function form when mounting", async () => {
    const app = container("app");
    const dim = container("dim");
    const mountIn = vi.fn(() => app);
    const dimMountIn = vi.fn(() => dim);
    const d = createDriver({ animate: false, steps: STEPS, mountIn, dimMountIn });
    expect(mountIn).not.toHaveBeenCalled();
    expect(dimMountIn).not.toHaveBeenCalled();

    d.drive();
    await nextFrame();
    expect(mountIn).toHaveBeenCalled();
    expect(dimMountIn).toHaveBeenCalled();
    expect(app.querySelector(".vt-popover")).not.toBeNull();
    expect(dim.querySelector("[data-vt-overlay]")).not.toBeNull();
  });

  it("leaves both in the body by default", async () => {
    createDriver({ animate: false, steps: STEPS }).drive();
    await nextFrame();

    expect(document.querySelector(".vt-popover")?.parentElement).toBe(document.body);
    expect(document.querySelector("[data-vt-overlay]")?.parentElement).toBe(document.body);
  });

  it("removes the popover and the overlay from the containers on destroy", async () => {
    const app = container("app");
    const dim = container("dim");
    const d = createDriver({ animate: false, steps: STEPS, mountIn: app, dimMountIn: dim });
    d.drive();
    await nextFrame();
    d.destroy();

    expect(app.childElementCount).toBe(0);
    expect(dim.childElementCount).toBe(0);
  });

  it("throws for a shadow-root host's inner element", async () => {
    const host = container("host");
    const inner = document.createElement("div");
    host.attachShadow({ mode: "open" }).appendChild(inner);

    expect(() => createDriver({ animate: false, steps: STEPS, mountIn: inner }).drive()).toThrow(
      "mountIn must be an element in the document"
    );
  });

  it("throws for a detached element", async () => {
    const detached = document.createElement("div");

    expect(() => createDriver({ animate: false, steps: STEPS, dimMountIn: detached }).drive()).toThrow(
      "mountIn must be an element in the document"
    );
  });

  it("throws for an element of another document", async () => {
    const other = document.implementation.createHTMLDocument("other");

    expect(() => createDriver({ animate: false, steps: STEPS, mountIn: other.body }).drive()).toThrow(
      "mountIn must be an element in the document"
    );
  });

  it("throws when the function form returns a non-element", async () => {
    expect(() =>
      createDriver({ animate: false, steps: STEPS, mountIn: (() => null) as unknown as () => Element }).drive()
    ).toThrow("mountIn must be an element in the document");
  });

  it("still mounts in an open dialog when the target is inside it", async () => {
    const app = container("app");
    const dim = container("dim");
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    dialog.innerHTML = `<button id="in-dialog" type="button">Go</button>`;
    document.body.appendChild(dialog);

    createDriver({
      animate: false,
      mountIn: app,
      dimMountIn: dim,
      steps: [{ element: "#in-dialog", popover: { title: "Dialog step" } }],
    }).drive();
    await nextFrame();

    expect(document.querySelector(".vt-popover")?.parentElement).toBe(dialog);
    expect(document.querySelector("[data-vt-overlay]")?.parentElement).toBe(dialog);
    expect(app.childElementCount).toBe(0);
    expect(dim.childElementCount).toBe(0);
  });

  it("moves the popover into mountIn when a later step leaves the dialog", async () => {
    const app = container("app");
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    dialog.innerHTML = `<button id="in-dialog" type="button">Go</button>`;
    document.body.appendChild(dialog);

    const d = createDriver({
      animate: false,
      mountIn: app,
      steps: [
        { element: "#in-dialog", popover: { title: "A" } },
        { element: "#intro", popover: { title: "B" } },
      ],
    });
    d.drive();
    await nextFrame();
    expect(document.querySelector(".vt-popover")?.parentElement).toBe(dialog);

    d.moveNext();
    await nextFrame();
    expect(document.querySelector(".vt-popover")?.parentElement).toBe(app);
  });
});
