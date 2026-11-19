import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const popover = (page: Page) => page.locator(".vt-popover");
const log = (page: Page) => page.evaluate(() => (window as unknown as { vtLog: string[] }).vtLog);

async function open(page: Page) {
  await page.goto("/fixtures/content.html");
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
  await expect.poll(() => log(page)).toContain("shown:titled");
}

test("a titled step renders its Element body and close button inside the popover", async ({ page }) => {
  await open(page);
  await expect(popover(page).locator(".vt-body #content-note")).toHaveText("Custom element body");
  await expect(popover(page).locator(".vt-popover-close-btn")).toBeVisible();
  await expect(popover(page).locator(".vt-popover-close-btn")).toHaveAttribute("data-track", "close");
  await expect(popover(page).locator(".vt-popover-close-btn")).toHaveAttribute("aria-label", "Dismiss tour");
  await expect(popover(page).locator(".vt-body")).toHaveAttribute("id", "vt-popover-body");
  await expect(popover(page)).toHaveAttribute("aria-describedby", "vt-popover-body");
  expect(await popover(page).locator(".vt-body").getAttribute("style")).toBeNull();
});

test("the dialog's accessible name is the title for a titled step and the label for an untitled one", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("dialog", { name: "Titled step" })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => log(page)).toContain("shown:untitled");
  await expect(page.getByRole("dialog", { name: "Untitled step label" })).toBeVisible();
  await expect(popover(page).locator(".vt-popover-description p")).toHaveText(["First paragraph", "Second paragraph"]);
  await expect(popover(page).locator(".vt-body")).toHaveCount(0);
});
