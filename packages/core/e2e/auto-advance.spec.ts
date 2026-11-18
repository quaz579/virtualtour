import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const log = (page: Page) => page.evaluate(() => (window as unknown as { vtLog: string[] }).vtLog);

async function open(page: Page) {
  await page.goto("/fixtures/auto-advance.html");
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => log(page)).toContain("shown:save");
}

test("clicking the real Save button advances once", async ({ page }) => {
  await open(page);
  await page.locator("#save").click();
  await expect.poll(() => log(page)).toContain("shown:name");
  const entries = await log(page);
  expect(entries).toContain("save-clicked");
  expect(entries.filter((e) => e === "shown:name")).toHaveLength(1);
});

test("an input event on the target advances through the engine", async ({ page }) => {
  await open(page);
  await page.locator("#save").click();
  await expect.poll(() => log(page)).toContain("shown:name");
  await page.locator("#name").fill("Ada");
  await expect.poll(() => log(page)).toContain("shown:page");
});

test("tours.current?.forward() from a page button moves the tour", async ({ page }) => {
  await open(page);
  await page.locator("#save").click();
  await expect.poll(() => log(page)).toContain("shown:name");
  await page.locator("#name").fill("Ada");
  await expect.poll(() => log(page)).toContain("shown:page");
  await page.locator("#page-forward").click();
  await expect.poll(() => log(page)).toContain("shown:end");
});
