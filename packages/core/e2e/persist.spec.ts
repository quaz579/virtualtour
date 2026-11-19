import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Win = { vtLog: string[]; vtTour: { id: string; isRunning(): boolean } };

const popover = (page: Page) => page.locator(".vt-popover");
const log = (page: Page) => page.evaluate(() => (window as unknown as Win).vtLog);
const stored = (page: Page) => page.evaluate(() => localStorage.getItem("virtualtour:persist-demo"));

async function open(page: Page, query = "") {
  await page.goto(`/fixtures/persist.html${query}`);
  await page.locator("html[data-ready=true]").waitFor();
}

async function clearStorage(page: Page) {
  await page.evaluate(() => localStorage.clear());
}

async function begin(page: Page) {
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
}

test.beforeEach(async ({ page }) => {
  await open(page);
  await clearStorage(page);
});

test("a completed tour is bypassed after reload and renders nothing", async ({ page }) => {
  await begin(page);
  await expect(popover(page)).toBeVisible();
  await page.locator(".vt-popover-next-btn").click();
  await page.locator(".vt-popover-next-btn").click();
  await page.locator(".vt-popover-next-btn").click();
  await expect(popover(page)).toHaveCount(0);
  await expect.poll(() => stored(page)).toContain("completedAt");

  await page.reload();
  await page.locator("html[data-ready=true]").waitFor();
  await begin(page);
  await expect.poll(() => log(page)).toEqual(["bypassed:completed"]);
  await expect(popover(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as Win).vtTour.isRunning())).toBe(false);
});

test("exiting at step 2 with resume shows step 2 after reload", async ({ page }) => {
  await open(page, "?resume=1");
  await begin(page);
  await expect(popover(page)).toBeVisible();
  await page.locator(".vt-popover-next-btn").click();
  await expect(page.locator(".vt-popover-title")).toHaveText("Two");
  await page.keyboard.press("Escape");
  await expect(popover(page)).toHaveCount(0);
  const saved = JSON.parse((await stored(page)) as string) as Record<string, unknown>;
  expect(saved["lastStepId"]).toBe("two");
  expect(typeof saved["exitedAt"]).toBe("string");

  await page.reload();
  await page.locator("html[data-ready=true]").waitFor();
  await begin(page);
  await expect(page.locator(".vt-popover-title")).toHaveText("Two");
  await expect.poll(() => log(page)).toEqual(["started", "shown:two"]);
});

test("without resume the tour restarts at step 1 after an exit", async ({ page }) => {
  await begin(page);
  await page.locator(".vt-popover-next-btn").click();
  await page.keyboard.press("Escape");
  await expect(popover(page)).toHaveCount(0);
  await page.reload();
  await page.locator("html[data-ready=true]").waitFor();
  await begin(page);
  await expect(page.locator(".vt-popover-title")).toHaveText("One");
});

test("clearing the stored record starts the tour from step 1 again", async ({ page }) => {
  await open(page, "?resume=1");
  await begin(page);
  await page.locator(".vt-popover-next-btn").click();
  await page.keyboard.press("Escape");
  await expect(popover(page)).toHaveCount(0);
  await expect.poll(() => stored(page)).toContain("exitedAt");

  await page.evaluate(() => localStorage.removeItem("virtualtour:persist-demo"));
  await page.reload();
  await page.locator("html[data-ready=true]").waitFor();
  await begin(page);
  await expect(page.locator(".vt-popover-title")).toHaveText("One");
});
