import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Win = { vtStepsRun(options?: Record<string, unknown>): Promise<void> };

async function open(page: Page): Promise<void> {
  await page.goto("/fixtures/avatar-steps.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

const run = (page: Page, options: Record<string, unknown> = {}) => page.evaluate((o) => (window as unknown as Win).vtStepsRun(o), options);
const avatar = (page: Page) => page.locator(".vt-avatar");
const next = (page: Page) => page.locator(".vt-popover-next-btn");

test("a four-step tour picks the animation for each step", async ({ page }) => {
  await open(page);
  await run(page);
  await expect(page.locator(".vt-popover-title")).toHaveText("Welcome");
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "wave");

  await next(page).click();
  await expect(page.locator(".vt-popover-title")).toHaveText("Right");
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "point-right");

  await next(page).click();
  await expect(page.locator(".vt-popover-title")).toHaveText("Think");
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "think");
  await page.waitForTimeout(1000);
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "think");

  await next(page).click();
  await expect(page.locator(".vt-popover-title")).toHaveText("Action");
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", /point-/);
  await next(page).click({ force: true });
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "alert");
  await expect(page.locator(".vt-popover-title")).toHaveText("Action");
  await page.locator("#action").click();
  await expect(avatar(page)).toHaveAttribute("data-vt-anim", "celebrate");
});

test("animations never block navigation", async ({ page }) => {
  await open(page);
  await run(page);
  await next(page).click();
  await next(page).click();
  await expect(page.locator(".vt-popover-title")).toHaveText("Think");
});

test("the avatar is gone as soon as the tour finishes", async ({ page }) => {
  await open(page);
  await run(page);
  await page.evaluate(() => (window as unknown as { vtStepsTour: { finish(): void } }).vtStepsTour.finish());
  await expect(avatar(page)).toHaveCount(0);
});

test("a pack that fails to load falls back to the dialog and reports once", async ({ page }) => {
  await open(page);
  await run(page, { broken: true });
  await expect(page.locator(".vt-popover-title")).toHaveText("Welcome");
  await expect(avatar(page)).toHaveCount(0);
  await expect(page.locator(".vt-popover")).toHaveClass(/vt-dialog/);
  expect(await page.evaluate(() => (window as unknown as { vtStepsErrors: string[] }).vtStepsErrors)).toHaveLength(1);
});
