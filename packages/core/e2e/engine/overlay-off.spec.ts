import { expect, test, type Page } from "@playwright/test";
import type { Config } from "../../src/engine/driver";
import { skipWhenEdgeMissing, box, clearLog, isActive, log, openFixture, popover, record, settle, topElementAt } from "./harness";

test.beforeEach(skipWhenEdgeMissing);

const STEPS = [
  { element: "#one", popover: { title: "Step 1" } },
  { element: "#two", popover: { title: "Step 2" } },
];

async function start(page: Page, config: Config) {
  await page.evaluate(config => {
    window.tour?.destroy();
    window.tour = window.__engine.createEngine({ animate: false, ...(config as Config) });
    window.tour.drive(0);
  }, { steps: STEPS, ...config } as object);
  await expect(popover(page)).toHaveCount(1);
  await settle(page);
}

async function centerOf(page: Page, selector: string) {
  const rect = await box(page.locator(selector));

  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test("with overlay: false a real pointer click reaches a page element outside the tour", async ({ page }) => {
  await record(page, "#three", ["click"]);
  await start(page, { overlay: false });

  await expect(page.locator(".vt-overlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-vt-dim", "");
  await expect(page.locator("body")).toHaveAttribute("data-vt-active", "");
  await expect(page.locator("#one")).toHaveAttribute("data-vt-target");

  const point = await centerOf(page, "#three");
  expect(await topElementAt(page, point.x, point.y)).toBe("three");

  await page.mouse.click(point.x, point.y);
  expect(await log(page)).toEqual(["click@#three"]);
  expect(await isActive(page)).toBe(true);
});

test("with the overlay on the same click is blocked", async ({ page }) => {
  await record(page, "#three", ["click"]);
  await start(page, { overlayClickBehavior: "none" });

  await expect(page.locator(".vt-overlay")).toHaveCount(1);
  await expect(page.locator("body")).toHaveAttribute("data-vt-dim", "");

  const point = await centerOf(page, "#three");
  expect(await topElementAt(page, point.x, point.y)).toBe("overlay");

  await clearLog(page);
  await page.mouse.click(point.x, point.y);
  expect(await log(page)).toEqual([]);
});
