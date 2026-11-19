import { expect, test, type Page } from "@playwright/test";
import { skipWhenEdgeMissing, activeIndex, box, log, nextButton, openFixture, overlay, popover, title, topElementAt } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

const bodyDuration = (page: Page) =>
  page.evaluate(() => document.body.style.getPropertyValue("--vt-animation-duration"));

const start = (page: Page, duration?: number) =>
  page.evaluate(duration => {
    window.tour = window.__engine.createEngine({
      ...(duration ? { duration } : {}),
      steps: [
        { element: "#intro", popover: { title: "Intro" } },
        { element: "#three", popover: { title: "Three" } },
      ],
    });
    window.tour.drive();
  }, duration);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("animation duration", () => {
  test("reaches the overlay and popover fade through a custom property, and goes with the tour", async ({ page }) => {
    await start(page, 1200);
    expect(await bodyDuration(page)).toBe("1200ms");
    await expect(overlay(page)).toHaveCSS("animation-duration", "1.2s");
    await expect(popover(page)).toHaveCSS("animation-duration", "1.2s");
    await expect(overlay(page)).toHaveCSS("animation-name", "animate-fade-in");

    await page.evaluate(() => window.tour.destroy());
    expect(await bodyDuration(page)).toBe("");

    await start(page);
    expect(await bodyDuration(page)).toBe("400ms");
    await expect(overlay(page)).toHaveCSS("animation-duration", "0.4s");
  });
});

test.describe("animated stage transition", () => {
  test("slides the cutout from one element to the next and settles on it", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        duration: 400,
        stagePadding: 0,
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#intro", popover: { title: "Intro" } },
          { element: "#three", popover: { title: "Three" } },
        ],
      });
      window.tour.drive();
    });
    await expect.poll(() => log(page)).toEqual(["highlighted Intro"]);
    expect(await activeIndex(page)).toBe(0);

    await page.evaluate(() => {
      const path = document.querySelector(".vt-overlay path")!;
      const frames: number[] = [];
      Object.assign(window, { frames });
      new MutationObserver(() => {
        frames.push(
          Number(
            path
              .getAttribute("d")!
              .split("Z")[1]
              .match(/M\S+,(\S+) /)![1]
          )
        );
      }).observe(path, { attributes: true, attributeFilter: ["d"] });

      window.tour.moveNext();
    });

    await expect.poll(() => log(page)).toEqual(["highlighted Intro", "highlighted Three"]);
    await expect(title(page)).toHaveText("Three");
    await expect(popover(page)).toBeVisible();
    expect(await activeIndex(page)).toBe(1);
    expect(await page.evaluate(() => window.tour.getState("__activeStep")?.popover?.title)).toBe("Three");

    const from = await box(page.locator("#intro"));
    const to = await box(page.locator("#three"));
    const frames = await page.evaluate(() => (window as unknown as { frames: number[] }).frames);
    const between = frames.filter(y => y > from.y + 1 && y < to.y - 1);
    expect(between.length).toBeGreaterThan(0);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(Math.abs(frames[frames.length - 1] - to.y)).toBeLessThan(2);

    await expect.poll(() => topElementAt(page, to.x + 5, to.y + 5)).toBe("three");
    expect(await topElementAt(page, from.x + 5, from.y + 5)).toBe("overlay");
  });
});

test("an animated tour moves the cutout and shows the next popover", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.__engine.createEngine({
      duration: 150,
      steps: [
        { element: "#intro", popover: { title: "Intro" } },
        { element: "#two", popover: { title: "Two" } },
      ],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("Intro");
  await nextButton(page).click();
  await expect(title(page)).toHaveText("Two");
  await expect(popover(page)).toBeVisible();

  const target = await box(page.locator("#two"));
  await expect.poll(() => topElementAt(page, target.x + 5, target.y + 5)).toBe("two");
  expect(await page.evaluate(() => document.body.classList.contains("vt-fade"))).toBe(true);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("jumps the cutout to the next element with no fade and no running animations", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.__engine.createEngine({
        duration: 2000,
        stagePadding: 0,
        steps: [
          { element: "#intro", popover: { title: "Intro" } },
          { element: "#three", popover: { title: "Three" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Intro");
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await page.evaluate(() => document.body.classList.contains("vt-simple"))).toBe(true);
    expect(await page.evaluate(() => document.body.classList.contains("vt-fade"))).toBe(false);

    await nextButton(page).click();
    await expect(title(page)).toHaveText("Three");
    const to = await box(page.locator("#three"));
    const y = await page.evaluate(() => {
      const d = document.querySelector(".vt-overlay path")!.getAttribute("d")!;
      return Number(d.split("Z")[1].match(/M\S+,(\S+) /)![1]);
    });
    expect(Math.abs(y - to.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("the media query alone stops the fade when an integrator forces the fade attribute", async ({ page }) => {
    await start(page);
    await page.evaluate(() => document.body.setAttribute("data-vt-fade", ""));
    await expect(overlay(page)).toHaveCSS("animation-name", "none");
    await expect(popover(page)).toHaveCSS("animation-name", "none");
  });
});
