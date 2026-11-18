import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const popover = (page: Page) => page.locator(".vt-popover");
const title = (page: Page) => page.locator(".vt-popover-title");
const log = (page: Page) => page.evaluate(() => (window as unknown as { vtLog: string[] }).vtLog);

async function open(page: Page, query = "") {
  await page.goto(`/fixtures/navigation.html${query}`);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
  await expect.poll(() => log(page)).toContain("shown:one");
}

test("forward and backward walk three steps and mark the popover with its step index", async ({ page }) => {
  await open(page);
  await expect(popover(page)).toHaveAttribute("data-vt-step", "0");
  await expect(title(page)).toHaveText("One");

  await page.locator(".vt-popover-next-btn").click();
  await expect(popover(page)).toHaveAttribute("data-vt-step", "1");
  await expect(title(page)).toHaveText("Two");

  await page.locator(".vt-popover-next-btn").click();
  await expect(popover(page)).toHaveAttribute("data-vt-step", "2");
  await expect(page.locator(".vt-popover-next-btn")).toHaveText("Done");

  await page.locator(".vt-popover-prev-btn").click();
  await expect(popover(page)).toHaveAttribute("data-vt-step", "1");
  await expect(popover(page)).toHaveClass(/vt-dialog/);
  expect(await log(page)).toEqual(["shown:one", "shown:two", "shown:three", "shown:two"]);
});

test("the arrow keys move between steps", async ({ page }) => {
  await open(page);
  await page.keyboard.press("ArrowRight");
  await expect(popover(page)).toHaveAttribute("data-vt-step", "1");
  await page.keyboard.press("ArrowRight");
  await expect(popover(page)).toHaveAttribute("data-vt-step", "2");
  await page.keyboard.press("ArrowLeft");
  await expect(popover(page)).toHaveAttribute("data-vt-step", "1");
});

test("Done on the last step finishes the tour and removes the popover and overlay", async ({ page }) => {
  await open(page);
  await page.locator(".vt-popover-next-btn").click();
  await expect(popover(page)).toHaveAttribute("data-vt-step", "1");
  await page.locator(".vt-popover-next-btn").click();
  await expect(popover(page)).toHaveAttribute("data-vt-step", "2");
  await page.locator(".vt-popover-next-btn").click();

  await expect(popover(page)).toHaveCount(0);
  await expect(page.locator(".vt-overlay")).toHaveCount(0);
  expect((await log(page)).slice(-2)).toEqual(["finished", "deactivated"]);
});

test("Escape with a declined exit prompt keeps the tour open", async ({ page }) => {
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.dismiss();
  });
  await open(page, "?prompt=Leave%20the%20tour%3F");

  await page.keyboard.press("Escape");

  await expect.poll(() => messages).toEqual(["Leave the tour?"]);
  await expect(popover(page)).toBeVisible();
  await expect(page.locator(".vt-overlay")).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { vtTour: { isRunning(): boolean } }).vtTour.isRunning())).toBe(true);
});

test("Escape with an accepted exit prompt removes the popover and overlay and returns focus to the start button", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await open(page, "?prompt=Leave%20the%20tour%3F");

  await page.keyboard.press("Escape");

  await expect(popover(page)).toHaveCount(0);
  await expect(page.locator(".vt-overlay")).toHaveCount(0);
  await expect(page.locator("#start")).toBeFocused();
  expect((await log(page)).slice(-2)).toEqual(["exited:escape", "deactivated"]);
});

test("hideCurrent keeps the tour running and the next forward shows the following step", async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { vtTour: { hideCurrent(): void } }).vtTour.hideCurrent());
  await expect(popover(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { vtTour: { isRunning(): boolean } }).vtTour.isRunning())).toBe(true);

  await page.evaluate(() => (window as unknown as { vtTour: { forward(): Promise<void> } }).vtTour.forward());
  await expect(popover(page)).toHaveAttribute("data-vt-step", "1");
});
