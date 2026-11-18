import { expect, test, type Page } from "@playwright/test";
import { box, openFixture, record, settle, skipWhenEdgeMissing, title } from "./engine/harness";

test.beforeEach(skipWhenEdgeMissing);
test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    window.tour = window.__engine.createEngine({
      animate: false,
      namespace: "abc",
      overlayClickBehavior: "none",
      steps: [
        { element: "#one", popover: { title: "One", side: "bottom" } },
        { element: "#two", popover: { title: "Two" } },
      ],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("One");
  await expect(page.locator("[data-vt-overlay]")).toHaveCount(1);
});

const pointAbove = async (page: Page, selector: string) => {
  const rect = await box(page.locator(selector));
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

test("the target and popover carry the configured namespace", async ({ page }) => {
  await expect(page.locator("#one")).toHaveClass(/abc-target/);
  await expect(page.locator("#one")).toHaveAttribute("data-vt-target");
  await expect(page.locator(".vt-popover")).toHaveAttribute("data-abc-step", "0");
  await expect(page.locator("body")).toHaveClass(/abc-active/);
  await expect(page.locator("body")).toHaveAttribute("data-vt-active");
  await expect(page.locator("body")).toHaveAttribute("data-vt-dim");
});

test("the overlay still blocks clicks outside the cut-out", async ({ page }) => {
  await record(page, "#two", ["click"]);
  await record(page, "#one", ["click"]);

  const outside = await pointAbove(page, "#two");
  await page.mouse.click(outside.x, outside.y);
  await settle(page);
  expect(await page.evaluate(() => window.log)).toEqual([]);

  const inside = await pointAbove(page, "#one");
  await page.mouse.click(inside.x, inside.y);
  await settle(page);
  expect(await page.evaluate(() => window.log)).toEqual(["click@#one"]);
});

test("a stylesheet rule on the namespaced class applies and the default class matches nothing", async ({ page }) => {
  await page.addStyleTag({
    content: ".abc-target { outline: 3px solid rgb(255, 0, 0); } .vt-target { outline: 3px solid rgb(0, 0, 255); }",
  });

  await expect(page.locator("#one")).toHaveCSS("outline-color", "rgb(255, 0, 0)");
  await expect(page.locator(".vt-target")).toHaveCount(0);
  await expect(page.locator(".abc-target")).toHaveCount(1);
});

test("the namespaced classes and mechanism attributes are removed on destroy", async ({ page }) => {
  await page.evaluate(() => window.tour.destroy());

  expect(
    await page.evaluate(
      () => document.querySelectorAll("[class*=abc-],[data-vt-active],[data-vt-target],[data-vt-overlay]").length,
    ),
  ).toBe(0);
});
