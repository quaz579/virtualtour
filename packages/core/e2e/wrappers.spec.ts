import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const popover = (page: Page) => page.locator(".vt-popover");
const title = (page: Page) => page.locator(".vt-popover-title");
const stepState = (page: Page) => page.locator("#step");
const runningState = (page: Page) => page.locator("#running");

async function openVue(page: Page, query = "") {
  await page.goto(`/fixtures/vue.html${query}`);
  await page.locator("html[data-ready=true]").waitFor();
}

test.describe("vue wrapper", () => {
  test("vue: a button starts the tour and the step id comes from composable state", async ({ page }) => {
    await openVue(page);
    await expect(runningState(page)).toHaveText("false");
    await expect(stepState(page)).toHaveText("none");

    await page.locator("#start").click();
    await expect(popover(page)).toBeVisible();
    await expect(title(page)).toHaveText("One");
    await expect(runningState(page)).toHaveText("true");
    await expect(stepState(page)).toHaveText("one");
  });

  test("vue: composable calls navigate forward, backward and exit", async ({ page }) => {
    await openVue(page);
    await page.locator("#start").click();
    await expect(stepState(page)).toHaveText("one");

    await page.locator("#hook-next").click();
    await expect(stepState(page)).toHaveText("two");
    await expect(title(page)).toHaveText("Two");

    await page.locator("#hook-next").click();
    await expect(stepState(page)).toHaveText("three");

    await page.locator("#hook-back").click();
    await expect(stepState(page)).toHaveText("two");
    await expect(title(page)).toHaveText("Two");

    await page.locator("#hook-exit").click();
    await expect(popover(page)).toHaveCount(0);
    await expect(runningState(page)).toHaveText("false");
    await expect(stepState(page)).toHaveText("none");
  });

  test("vue: popover buttons keep the composable state in sync", async ({ page }) => {
    await openVue(page);
    await page.locator("#start").click();
    await page.locator(".vt-popover-next-btn").click();
    await expect(stepState(page)).toHaveText("two");
    await page.locator(".vt-popover-next-btn").click();
    await page.locator(".vt-popover-next-btn").click();
    await expect(popover(page)).toHaveCount(0);
    await expect(runningState(page)).toHaveText("false");
  });

  test("vue: autoStart shows one popover on step one", async ({ page }) => {
    await openVue(page, "?autostart=1");
    await expect(popover(page)).toBeVisible();
    await expect(stepState(page)).toHaveText("one");
    await page.waitForTimeout(300);
    await expect(popover(page)).toHaveCount(1);
    await expect(stepState(page)).toHaveText("one");
  });

  test("vue: unmounting the provider removes a running tour", async ({ page }) => {
    await openVue(page);
    await page.locator("#start").click();
    await expect(popover(page)).toBeVisible();
    await page.locator("#unmount").click();
    await expect(page.locator("#gone")).toBeVisible();
    await expect(popover(page)).toHaveCount(0);
  });
});
