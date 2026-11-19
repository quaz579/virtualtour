import { expect, test, type Page } from "@playwright/test";
import type { createTour } from "../../src/index";
import { skipWhenEdgeMissing, near, openFixture, popover, title } from "./harness";

declare global {
  interface Window {
    __tour: { createTour: typeof createTour };
  }
}

test.beforeEach(skipWhenEdgeMissing);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const targetTop = (page: Page) => page.evaluate(() => document.querySelector("#far")!.getBoundingClientRect().top);

async function startFar(page: Page, step: Record<string, unknown>, config: Record<string, unknown> = {}) {
  await page.evaluate(
    ({ step, config }) => {
      window.tour = window.__engine.createEngine({ animate: false, ...config });
      window.tour.highlight({ element: "#far", popover: { title: "Far" }, ...step });
    },
    { step, config }
  );
  await expect(title(page)).toHaveText("Far");
}

test("the default rule scrolls a target 1600px down into view", async ({ page }) => {
  await startFar(page, {});
  expect(await scrollY(page)).toBeGreaterThan(0);
  await expect(page.locator("#far")).toBeInViewport({ ratio: 1 });
});

test("scrollIntoView false leaves the page where it was and positions against the off-screen target", async ({ page }) => {
  await startFar(page, { scrollIntoView: false });
  expect(await scrollY(page)).toBe(0);
  expect(await targetTop(page)).toBeGreaterThan(await page.evaluate(() => window.innerHeight));
  await expect(page.locator("#far")).not.toBeInViewport();
});

test("scrollIntoView options put the target at the top of the viewport", async ({ page }) => {
  await page.evaluate(() => {
    document.body.style.paddingBottom = "2000px";
  });
  await startFar(page, { scrollIntoView: { block: "start" } });
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  near(await targetTop(page), 0);
});

test("Config.scrollIntoView applies to steps that do not set their own", async ({ page }) => {
  await startFar(page, {}, { scrollIntoView: false });
  expect(await scrollY(page)).toBe(0);
});

test("a step setting scrollIntoView false still shows its popover without scrolling", async ({ page }) => {
  await startFar(page, { scrollIntoView: false });
  await expect(popover(page)).toBeAttached();
  expect(await scrollY(page)).toBe(0);
});

test("reduced motion makes smoothScroll an instant scroll", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startFar(page, {}, { smoothScroll: true });
  expect(await scrollY(page)).toBeGreaterThan(0);
  await expect(page.locator("#far")).toBeInViewport({ ratio: 1 });
});

test("reduced motion also stops an explicit smooth scrollIntoView", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startFar(page, { scrollIntoView: { behavior: "smooth", block: "center" } });
  expect(await scrollY(page)).toBeGreaterThan(0);
});

test("without reduced motion an explicit smooth scrollIntoView still glides", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const immediate = await page.evaluate(() => {
    window.tour = window.__engine.createEngine({ animate: false });
    window.tour.highlight({ element: "#far", scrollIntoView: { behavior: "smooth", block: "center" }, popover: { title: "Far" } });

    return window.scrollY;
  });
  expect(immediate).toBe(0);
  await expect(page.locator("#far")).toBeInViewport({ ratio: 1 });
});

test("revealWith is awaited and the engine does not scroll a second time", async ({ page }) => {
  await page.evaluate(() => {
    const far = document.querySelector<HTMLElement>("#far")!;
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element["scrollIntoView"]>) {
      if (this === far) window.log.push("scrollIntoView");
      return original.apply(this, args);
    };
    const tour = window.__tour.createTour({
      name: "reveal",
      animate: false,
      steps: [
        {
          id: "far",
          title: "Far",
          target: "#far",
          revealWith: async (el: Element) => {
            window.log.push("reveal-start");
            await new Promise((resolve) => setTimeout(resolve, 150));
            el.scrollIntoView({ block: "center" });
            window.log.push("reveal-end");
          },
        },
      ],
    });
    void tour.start();
  });
  await expect(title(page)).toHaveText("Far");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.log)).toEqual(["reveal-start", "scrollIntoView", "reveal-end"]);
  await expect(page.locator("#far")).toBeInViewport({ ratio: 1 });
});
