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

test("configure changes body and button text in place, keeps the wrapper and keeps focus inside", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const w = window as unknown as { vtTour: { steps: { element?: HTMLElement | null }[] }; vtWrapper: HTMLElement | null | undefined };
    w.vtWrapper = w.vtTour.steps[0]!.element;
  });
  const second = popover(page).locator(".vt-footer .vt-button").nth(1);
  await second.focus();

  await page.evaluate(() => {
    (window as unknown as { vtTour: { stepById(id: string): { configure(p: object): void } } }).vtTour
      .stepById("titled")
      .configure({
        title: "Retitled",
        body: "Plain replacement body",
        buttons: [
          { text: "Log it", kind: "secondary", action: "forward" },
          { text: "Renamed next", action: "forward" },
        ],
      });
  });

  await expect(popover(page).locator(".vt-popover-title")).toHaveText("Retitled");
  await expect(popover(page).locator(".vt-popover-description")).toHaveText("Plain replacement body");
  await expect(popover(page).locator(".vt-body")).toHaveCount(0);
  await expect(popover(page).locator(".vt-footer .vt-button")).toHaveText(["Log it", "Renamed next"]);
  await expect(page.getByRole("dialog", { name: "Retitled" })).toBeVisible();

  const same = await page.evaluate(() => {
    const w = window as unknown as { vtTour: { steps: { element?: HTMLElement | null }[] }; vtWrapper: HTMLElement };
    return w.vtTour.steps[0]!.element === w.vtWrapper && document.querySelector(".vt-popover") === w.vtWrapper;
  });
  expect(same).toBe(true);
  await expect(second).toBeFocused();
  expect(await page.evaluate(() => !!document.querySelector(".vt-popover")?.contains(document.activeElement))).toBe(true);
  expect(await log(page)).toEqual(["shown:titled"]);
});
