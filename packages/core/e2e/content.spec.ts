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

  await popover(page).getByRole("button", { name: "Next step" }).click();
  await expect.poll(() => log(page)).toContain("shown:untitled");
  await expect(page.getByRole("dialog", { name: "Untitled step label" })).toBeVisible();
  await expect(popover(page).locator(".vt-popover-description p")).toHaveText(["First paragraph", "Second paragraph"]);
  await expect(popover(page).locator(".vt-body")).toHaveCount(0);
});

test("custom buttons render in a footer, run their actions and sit after the close button in Tab order", async ({ page }) => {
  await open(page);
  const buttons = popover(page).locator(".vt-footer .vt-button");
  await expect(buttons).toHaveText(["Log it", "Next step"]);
  await expect(buttons.first()).toHaveClass(/vt-button--secondary/);
  await expect(buttons.first()).toHaveAttribute("data-track", "log");
  await expect(popover(page).locator(".vt-popover-progress-text")).toHaveText("1 of 2");

  const order: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "none";
        if (el.classList.contains("vt-popover-close-btn")) return "close";
        if (el.classList.contains("vt-button")) return el.textContent ?? "";
        return el.className || el.tagName;
      }),
    );
  }
  const trimmed = order.filter((name) => name === "close" || name === "Log it" || name === "Next step");
  expect(trimmed.slice(0, 3)).toEqual(["close", "Log it", "Next step"]);

  await buttons.first().click();
  await expect.poll(() => log(page)).toContain("clicked:titled");
  await expect(popover(page)).toBeVisible();

  await buttons.nth(1).click();
  await expect.poll(() => log(page)).toContain("shown:untitled");
  await expect(popover(page).locator(".vt-footer")).toHaveCount(0);
  await expect(popover(page).locator(".vt-popover-progress-text")).toHaveText("2 of 2");
});
