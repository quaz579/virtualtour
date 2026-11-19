import { expect, test, type Page } from "@playwright/test";
import {
  skipWhenEdgeMissing,
  activeIndex,
  box,
  closeButton,
  log,
  nextButton,
  openFixture,
  overlay,
  popover,
  prevButton,
  record,
  settle,
  title,
} from "./harness";

test.beforeEach(skipWhenEdgeMissing);

const indicator = (page: Page) => page.locator(".vt-popover-instruction-indicator");
const NUDGE_CLASS = /vt-popover-nudge/;

const instruction = (page: Page) => page.locator(".vt-popover-instruction");

type NudgeWindow = Window & { __nudges: number };

const nudgeCount = (page: Page) => page.evaluate(() => (window as unknown as NudgeWindow).__nudges);

async function watchNudges(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as NudgeWindow;
    w.__nudges = 0;
    const has = (value: string | null) => (value ?? "").split(/\s+/).includes("vt-popover-nudge");
    new MutationObserver(records => {
      records.forEach((record, index) => {
        if (record.attributeName !== "class") {
          return;
        }

        const next = records.slice(index + 1).find(other => other.target === record.target);
        const after = next ? next.oldValue : (record.target as Element).getAttribute("class");
        if (!has(record.oldValue) && has(after)) {
          w.__nudges += 1;
        }
      });
    }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["class"] });
  });
}

async function holdTimer(page: Page, delay: number) {
  await page.evaluate(delay => {
    const w = window as unknown as { __held: Array<() => void> };
    w.__held = [];
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === delay) {
        w.__held.push(() => original(handler, 0, ...args));

        return 0;
      }

      return original(handler, timeout, ...args);
    }) as typeof window.setTimeout;
  }, delay);
}

const releaseTimer = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __held: Array<() => void> };
    w.__held.splice(0).forEach(release => release());
  });

async function expectNudge(page: Page, act: () => Promise<void>) {
  const before = await nudgeCount(page);
  await act();
  await expect.poll(() => nudgeCount(page)).toBeGreaterThan(before);
  await expect(popover(page)).not.toHaveClass(NUDGE_CLASS, { timeout: 2000 });
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await watchNudges(page);
});

test.describe("instruction steps", () => {
  test("nudge on ArrowRight and on an overlay click that would close, even without a Next button", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        showButtons: ["close"],
        overlayClickBehavior: "close",
        onNextClick: () => {
          window.log.push("onNextClick");
        },
        steps: [
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(instruction(page)).toHaveText("Click One.");
    await expect(nextButton(page)).toBeHidden();
    await settle(page);

    await expectNudge(page, () => page.keyboard.press("ArrowRight"));
    await expectNudge(page, () => page.mouse.click(5, 5));

    await expect(title(page)).toHaveText("Act");
    expect(await page.evaluate(() => window.tour.isActive())).toBe(true);
    expect(await activeIndex(page)).toBe(0);
    expect(await log(page)).toEqual([]);
  });

  test("stay quiet on Next and ArrowRight while the popover waits for the next element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        steps: [
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#later", waitForElement: 30000, popover: { title: "Later" } },
        ],
      });
      window.tour.drive();
    });
    await expect(instruction(page)).toHaveText("Click One.");
    await page.evaluate(() => window.tour.moveNext());
    await expect(popover(page)).toHaveClass(/vt-popover-waiting/);

    await nextButton(page).click({ force: true });
    await page.keyboard.press("ArrowRight");
    await settle(page);

    await expect(popover(page)).not.toHaveClass(NUDGE_CLASS);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(0);
  });

  test("leave ArrowLeft, Previous, Close and the read steps around them working as usual", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        overlayClickBehavior: "nextStep",
        steps: [
          { element: "#intro", popover: { title: "Read" } },
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "Last" } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Act");
    await settle(page);

    await page.keyboard.press("ArrowLeft");
    await expect(title(page)).toHaveText("Read");
    await settle(page);

    await page.evaluate(() => window.tour.updatePopover({ instruction: "Now click Intro." }));
    await expect(instruction(page)).toHaveCount(0);
    await expect(popover(page)).not.toHaveClass(/vt-popover-has-instruction/);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Act");
    await settle(page);

    await prevButton(page).click();
    await expect(title(page)).toHaveText("Read");
    await settle(page);

    await page.mouse.click(5, 5);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(1);

    await closeButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.tour.isActive())).toBe(false);
  });

  test("on a single highlight are a plain line, and an overlay click closes as usual", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({ animate: false });
      window.tour.highlight({ element: "#one", popover: { title: "Hi", instruction: "Click it." } });
    });
    await expect(instruction(page)).toHaveText("Click it.");
    await expect(page.locator(".vt-popover-instruction-indicator")).toBeHidden();
    await expect(page.locator(".vt-popover-footer")).toBeHidden();
    await expect(overlay(page)).toHaveCount(1);

    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.tour.isActive())).toBe(false);
  });
});

test.describe("instruction steps while animating", () => {
  const createTour = (page: Page, index: number) =>
    page.evaluate(index => {
      window.tour = window.__engine.createEngine({
        duration: 1000,
        overlayClickBehavior: "nextStep",
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#intro", popover: { title: "Read" } },
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "Last" } },
        ],
      });
      window.tour.drive(index);
    }, index);

  test("an overlay click does not skip an action step that is still animating in", async ({ page }) => {
    const result = await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        duration: 1000,
        overlayClickBehavior: "nextStep",
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#intro", popover: { title: "Read" } },
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "Last" } },
        ],
      });
      const clicked = new Promise<{ log: string[]; index: number | undefined }>(resolve => {
        const observer = new MutationObserver(() => {
          const path = document.querySelector(".vt-overlay path");
          if (!path) {
            return;
          }

          observer.disconnect();
          path.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          resolve({ log: window.log.slice(), index: window.tour.getActiveIndex() });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      });
      window.tour.drive(1);

      return clicked;
    });
    expect(result).toEqual({ log: [], index: 1 });

    await expect.poll(() => log(page)).toEqual(["highlighted Act"]);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(1);
  });

  test("an overlay click does not skip an action step during the move from a read step", async ({ page }) => {
    await createTour(page, 0);
    await expect.poll(() => log(page)).toEqual(["highlighted Read"]);

    const result = await page.evaluate(() => {
      window.tour.moveNext();
      const path = document.querySelector(".vt-overlay path")!;
      path.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      return { log: window.log.slice(), index: window.tour.getActiveIndex() };
    });
    expect(result).toEqual({ log: ["highlighted Read"], index: 1 });

    await expect.poll(() => log(page)).toEqual(["highlighted Read", "highlighted Act"]);
    await expectNudge(page, () => page.mouse.click(5, 5));
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(1);
  });
});

test.describe("advanceDelay", () => {
  test("ignores Next, ArrowRight and the overlay during the pause, without a nudge", async ({ page }) => {
    await holdTimer(page, 1500);
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        advanceDelay: 1500,
        overlayClickBehavior: "nextStep",
        onNextClick: (_element, step) => {
          window.log.push(`onNextClick ${step.popover?.title}`);
          window.tour.moveNext();
        },
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "After" } },
          { element: "#intro", popover: { title: "Last" } },
        ],
      });
      window.tour.drive();
      new MutationObserver(() => {
        if (document.querySelector(".vt-popover-nudge")) {
          window.log.push("nudged");
        }
      }).observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
    });
    await expect(instruction(page)).toHaveText("Click One.");

    await page.locator("#one").click();
    await expect(popover(page)).toHaveClass(/vt-popover-instruction-done/);
    await nextButton(page).click({ force: true });
    await page.keyboard.press("ArrowRight");
    await page.mouse.click(5, 5);
    await settle(page);
    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("Act");

    await releaseTimer(page);
    await expect(title(page)).toHaveText("After");
    await settle(page);
    expect(await log(page)).toEqual(["onNextClick Act"]);
    expect(await activeIndex(page)).toBe(1);
  });
});

test.describe("instruction steps as rendered", () => {
  test("show the instruction with its dot and a disabled-looking Next, and can't be skipped", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        overlayClickBehavior: "nextStep",
        onNextClick: (_element, step) => {
          window.log.push(`onNextClick ${step.popover?.title}`);
          window.tour.moveNext();
        },
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click <b>One</b>." } },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    await expect(instruction(page)).toHaveText("Click One.");
    await expect(popover(page)).toHaveClass(/vt-popover-has-instruction/);
    await expect(nextButton(page)).toBeVisible();
    await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");
    expect(await nextButton(page).evaluate(button => (button as HTMLButtonElement).disabled)).toBe(false);
    await expect(nextButton(page)).toHaveCSS("color", "rgb(163, 163, 163)");

    const row = await box(instruction(page));
    const dot = await box(indicator(page));
    const text = await box(page.locator(".vt-popover-instruction-text"));
    expect(dot.x).toBeGreaterThanOrEqual(text.x + text.width);
    expect(dot.x + dot.width).toBeLessThanOrEqual(row.x + row.width);
    await expect(indicator(page)).toHaveCSS("animation-name", "vt-instruction-pulse");
    await expect(indicator(page)).toHaveAttribute("aria-hidden", "true");

    const nudged = async (act: () => Promise<void>) => {
      await expectNudge(page, act);
      await expect(title(page)).toHaveText("Act");
    };
    await nudged(() => nextButton(page).click({ force: true }));
    await nudged(async () => {
      await nextButton(page).focus();
      await page.keyboard.press("Enter");
    });
    await nudged(() => page.keyboard.press("Space"));
    await nudged(() => page.keyboard.press("ArrowRight"));
    await nudged(() => page.mouse.click(5, 5));
    expect(await log(page)).toEqual([]);

    await page.locator("#one").click();
    await expect(title(page)).toHaveText("After");
    expect(await log(page)).toEqual(["onNextClick Act"]);
  });

  test("collapse the footer when there is no next button to show", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        showButtons: ["close"],
        steps: [{ element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One." } }, {}],
      });
      window.tour.drive();
    });

    await expect(instruction(page)).toBeVisible();
    await expect(indicator(page)).toBeVisible();
    await expect(page.locator(".vt-popover-footer")).toBeHidden();
    const pop = await box(popover(page));
    const row = await box(instruction(page));
    expect(pop.y + pop.height - (row.y + row.height)).toBeLessThan(20);
  });

  test("keep the dot on the first line of a long instruction", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        steps: [
          {
            element: "#one",
            popover: {
              title: "Act",
              instruction: "Click One, then wait for the list to load and pick the role you want from it.",
            },
          },
        ],
      });
      window.tour.drive();
    });

    const row = await box(instruction(page));
    const dot = await box(indicator(page));
    expect(row.height).toBeGreaterThan(50);
    expect(dot.y - row.y).toBeLessThan(20);
    expect(dot.x + dot.width).toBeLessThanOrEqual(row.x + row.width);
  });

  test("let other gestures through unless advanceOn is strict", async ({ page }) => {
    await page.evaluate(() => {
      document.addEventListener("contextmenu", event => event.preventDefault());
      window.tour = window.__engine.createEngine({
        animate: false,
        steps: [
          { element: "#one", advanceOn: "dblclick", popover: { title: "Loose", instruction: "Double-click." } },
          {
            element: "#two",
            advanceOn: { event: "dblclick", strict: true },
            popover: { title: "Strict", instruction: "Double-click." },
          },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, "#one", ["contextmenu", "click"]);
    await record(page, "#two", ["contextmenu", "mousedown", "click", "dblclick"]);

    await page.locator("#one").click({ button: "right" });
    await settle(page);
    expect(await log(page)).toEqual(["contextmenu@#one"]);
    await expect(popover(page)).not.toHaveClass(/vt-popover-nudge/);

    await page.locator("#one").dblclick();
    await expect(title(page)).toHaveText("Strict");
    await settle(page);
    await page.evaluate(() => window.log.splice(0));

    await expectNudge(page, () => page.locator("#two").click({ button: "right" }));
    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("Strict");

    await page.locator("#two").dblclick();
    await expect(title(page)).toHaveText("After");
    expect(await log(page)).toEqual(["mousedown@#two", "click@#two", "mousedown@#two", "click@#two", "dblclick@#two"]);
  });

  test("show the done state for advanceDelay, then move on", async ({ page }) => {
    await holdTimer(page, 3000);
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        advanceDelay: 3000,
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", advanceOn: "click", popover: { title: "Again", instruction: "Click Two." } },
        ],
      });
      window.tour.drive();
    });
    await expect(indicator(page)).toHaveCSS("border-radius", "50%");
    const waitingColor = await instruction(page).evaluate(element => getComputedStyle(element).backgroundColor);

    await page.locator("#one").click();
    await expect(popover(page)).toHaveClass(/vt-popover-instruction-done/);
    await expect(indicator(page)).toHaveCSS("animation-name", "none");
    await expect(indicator(page)).toHaveCSS("border-bottom-width", "2px");
    await expect(instruction(page)).toHaveCSS("color", "rgb(21, 128, 61)");
    await expect(nextButton(page)).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(nextButton(page)).toHaveCSS("background-color", "rgb(21, 128, 61)");
    await expect(nextButton(page)).toHaveCSS("opacity", "1");
    await expect(page.locator(".vt-live-region")).toHaveText("Done");
    const doneColor = await instruction(page).evaluate(element => getComputedStyle(element).backgroundColor);
    expect(doneColor).not.toBe(waitingColor);

    await nextButton(page).click({ force: true });
    await expect(popover(page)).not.toHaveClass(/vt-popover-nudge/);
    await expect(title(page)).toHaveText("Act");

    await releaseTimer(page);
    await expect(title(page)).toHaveText("Again");
    await expect(popover(page)).not.toHaveClass(/vt-popover-instruction-done/);
    await expect(nextButton(page)).toHaveText("Done");
    await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");

    await page.locator("#two").click();
    await expect(popover(page)).toHaveClass(/vt-popover-instruction-done/);
    await releaseTimer(page);
    await expect(popover(page)).toHaveCount(0);
  });

  test("respect reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        animate: false,
        steps: [{ element: "#one", popover: { title: "Act", instruction: "Click One." } }],
      });
      window.tour.drive();
    });

    await expect(indicator(page)).toHaveCSS("animation-name", "none");
  });
});

test.describe("instruction CSS", () => {
  const startWithCss = async (page: Page, css: string) => {
    await page.evaluate(css => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);

      window.tour = window.__engine.createEngine({
        animate: false,
        steps: [{ element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click it." } }],
      });
      window.tour.drive();
    }, css);
    await expect(title(page)).toHaveText("Act");
  };

  test("a plain rule hides the dot on an action step", async ({ page }) => {
    await startWithCss(page, ".vt-popover-instruction-indicator { display: none; }");

    await expect(instruction(page)).toBeVisible();
    await expect(indicator(page)).toBeHidden();
  });

  test("a row hidden by CSS stays hidden while the popover is nudged", async ({ page }) => {
    await startWithCss(page, ".vt-popover-instruction { display: none; }");
    await expect(instruction(page)).toBeHidden();

    const duringNudge = await page.evaluate(() => {
      window.tour.nudge();
      const popoverEl = document.querySelector(".vt-popover")!;
      const row = document.querySelector(".vt-popover-instruction")!;

      return { isNudged: popoverEl.classList.contains("vt-popover-nudge"), display: getComputedStyle(row).display };
    });
    expect(duringNudge).toEqual({ isNudged: true, display: "none" });
  });
});
