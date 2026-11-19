import { afterEach, describe, expect, it, vi } from "vitest";
import type { DriveStep } from "../../../src/engine/driver";
import { createDriver, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "../utils";
import { findExecutable, FLAG, PAYLOADS, pwned, stripSanitizer } from "../../payloads";

useDriverHarness();

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[FLAG];
});

const step = (popover: DriveStep["popover"] = {}): DriveStep[] => [
  { ...SAMPLE_STEPS[0], popover: { title: "T", description: "D", ...popover } },
  SAMPLE_STEPS[1],
];

async function start(steps: DriveStep[], sanitize?: (html: string) => string) {
  const d = createDriver({ animate: false, showProgress: true, steps, ...(sanitize ? { sanitize } : {}) });
  d.drive(0);
  await nextFrame();
  return d;
}

const cases = Object.entries(PAYLOADS);
const markup = (payload: string) => `ok ${payload} end`;

describe.each(cases)("%s payload through every engine sink", (_name, payload) => {
  it("title, description, instruction, progress and button text", async () => {
    const sanitize = vi.fn(stripSanitizer);
    await start(
      step({
        title: markup(payload),
        description: markup(payload),
        instruction: markup(payload),
        progressText: markup(payload),
        nextBtnText: markup(payload),
        prevBtnText: markup(payload),
      }),
      sanitize
    );
    expect(findExecutable(popoverEl()!)).toEqual([]);
    expect(popoverEl()!.textContent).toContain("ok");
    expect(sanitize).toHaveBeenCalled();
    expect(pwned()).toBeUndefined();
  });

  it("updatePopover patches", async () => {
    const d = await start(step(), stripSanitizer);
    d.updatePopover({
      title: markup(payload),
      description: markup(payload),
      instruction: markup(payload),
      progressText: markup(payload),
      nextBtnText: markup(payload),
      prevBtnText: markup(payload),
    });
    await nextFrame();
    expect(findExecutable(popoverEl()!)).toEqual([]);
    expect(pwned()).toBeUndefined();
  });

  it("nudge patch object and nudge feedback message", async () => {
    const d = await start(step({ instruction: "Do it" }), stripSanitizer);
    d.nudge({ instruction: markup(payload), progressText: markup(payload), nextBtnText: markup(payload) });
    await nextFrame();
    expect(findExecutable(popoverEl()!)).toEqual([]);
    d.nudge(markup(payload));
    await nextFrame();
    const feedback = popoverEl()!.querySelector(".vt-popover-feedback")!;
    expect(feedback.textContent).toContain("ok");
    expect(findExecutable(popoverEl()!)).toEqual([]);
    expect(pwned()).toBeUndefined();
  });

  it("a sanitizer that returns an empty string hides the instruction row, feedback and title", async () => {
    const d = await start(step({ instruction: payload, title: payload }), () => "");
    const row = popoverEl()!.querySelector<HTMLElement>(".vt-popover-instruction")!;
    expect(row.style.display).toBe("none");
    expect(popoverEl()!.querySelector<HTMLElement>(".vt-popover-title")!.style.display).toBe("none");
    expect(popoverEl()!.hasAttribute("aria-labelledby")).toBe(false);
    d.nudge(payload);
    await nextFrame();
    expect(popoverEl()!.querySelector<HTMLElement>(".vt-popover-feedback")!.style.display).toBe("none");
  });

  it("control: without a sanitizer the payload reaches the DOM", async () => {
    await start(step({ description: markup(payload) }));
    expect(findExecutable(popoverEl()!).length).toBeGreaterThan(0);
  });
});

describe("sanitizer failures", () => {
  it("renders the string as text when the sanitizer throws", async () => {
    await start(step({ instruction: PAYLOADS.img! }), () => {
      throw new Error("boom");
    });
    const text = popoverEl()!.querySelector(".vt-popover-instruction-text")!;
    expect(text.querySelector("img")).toBeNull();
    expect(text.textContent).toBe(PAYLOADS.img);
  });

  it("does not call the sanitizer for strings with no markup", async () => {
    const sanitize = vi.fn((html: string) => html);
    await start(step({ instruction: "plain", progressText: "1 of 2" }), sanitize);
    expect(sanitize).not.toHaveBeenCalled();
  });
});

describe("aria-labelledby", () => {
  it("is set only when the title renders", async () => {
    const d = await start(step({ title: "Shown", label: "Fallback" }));
    expect(popoverEl()!.getAttribute("aria-labelledby")).toBe("vt-popover-title");
    d.updatePopover({ title: "   " });
    await nextFrame();
    expect(popoverEl()!.hasAttribute("aria-labelledby")).toBe(false);
    expect(popoverEl()!.getAttribute("aria-label")).toBe("Fallback");
  });
});
