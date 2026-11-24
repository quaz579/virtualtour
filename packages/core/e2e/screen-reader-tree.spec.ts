import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const log = (page: Page) => page.evaluate(() => window.vtLog);

async function start(page: Page, tour: string, first: string) {
  await page.goto(`/fixtures/a11y.html?tour=${tour}`);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => log(page)).toContain(`shown:${first}`);
}

test("the accessibility tree exposes the tour as a named dialog with reachable controls", async ({ page }) => {
  await start(page, "four", "s1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAccessibleName(/\S/);
  const tree = await dialog.ariaSnapshot();
  expect(tree).toMatch(/- dialog "[^"]+"/);
  expect(tree).toMatch(/- button "[^"]+"/);
  await expect(dialog.getByRole("button")).not.toHaveCount(0);
  for (const button of await dialog.getByRole("button").all()) await expect(button).toHaveAccessibleName(/\S/);
});

test("focus moves into the dialog, Escape closes it and focus returns to the trigger", async ({ page }) => {
  await start(page, "four", "s1");
  const inside = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
  expect(inside).toBe(true);
  await page.keyboard.press("Escape");
  await expect.poll(() => log(page)).toContain("deactivated");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#start")).toBeFocused();
});
