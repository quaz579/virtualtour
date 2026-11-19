import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const ids = ["core", "placement", "spotlight", "action", "json", "motion", "avatar", "avatar-classic"];
const popover = (page: Page) => page.locator(".vt-popover");

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

async function run(page: Page, id: string): Promise<void> {
  await page.evaluate((scenario) => (window as unknown as { vtDemo: { run(id: string): Promise<void> } }).vtDemo.run(scenario), id);
}

const running = (page: Page) => page.evaluate(() => (window as unknown as { vtDemo: { tour?: { isRunning(): boolean } } }).vtDemo.tour?.isRunning() ?? false);

test("the picker lists every scenario", async ({ page }) => {
  await open(page);
  const listed = await page.locator("#scenario-buttons button").evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset["id"]));
  expect(listed).toEqual(ids);
});

for (const id of ids) {
  test(`scenario ${id} runs from first step to the end`, async ({ page }) => {
    await open(page);
    await run(page, id);
    await expect(popover(page)).toBeVisible();
    if (id.startsWith("avatar")) await expect(page.locator(".vt-avatar")).toBeVisible();

    for (let i = 0; i < 12 && (await running(page)); i += 1) {
      await expect(popover(page)).toBeVisible();
      await page.evaluate(() => {
        const tour = (window as unknown as { vtDemo: { tour: { advance(): void; forward(): Promise<void> } } }).vtDemo.tour;
        tour.advance();
        void tour.forward();
      });
      await page.waitForTimeout(150);
    }
    await expect.poll(() => running(page)).toBe(false);
    expect(await page.evaluate(() => (window as unknown as { vtDemo: { errors: string[] } }).vtDemo.errors)).toEqual([]);
  });
}

test("action scenario waits for real interaction", async ({ page }) => {
  await open(page);
  await run(page, "action");
  await expect(popover(page)).toContainText("Type a name");
  await page.locator("#customer").focus();
  await expect(popover(page)).toContainText("Save", { timeout: 5000 });
  await page.locator("#save").click();
  await expect(popover(page)).toContainText("All done", { timeout: 5000 });
});

test("dark theme and right-to-left direction apply to the page and the popover", async ({ page }) => {
  await open(page, "?scenario=core&theme=dark&dir=rtl");
  await expect(page.locator("html")).toHaveAttribute("data-vt-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(popover(page)).toBeVisible();
  const background = await popover(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe("rgb(255, 255, 255)");
  await page.evaluate(() => (window as unknown as { vtDemo: { tour: { goTo(i: number): Promise<void> } } }).vtDemo.tour.goTo(1));
  await expect(popover(page)).toContainText("Search");
  const box = await popover(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
});

test("the theme and direction selectors work", async ({ page }) => {
  await open(page);
  await page.selectOption("#theme", "dark");
  await page.selectOption("#dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-vt-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("screenshot gallery", async ({ page }, testInfo) => {
  const dir = process.env["VT_GALLERY_DIR"];
  test.skip(!dir, "set VT_GALLERY_DIR to write the gallery");
  test.setTimeout(180_000);
  mkdirSync(dir as string, { recursive: true });
  for (const theme of ["light", "dark"]) {
    for (const id of ids) {
      await open(page, `?theme=${theme}`);
      await run(page, id);
      await expect(popover(page)).toBeVisible();
      await page.evaluate(() => {
        const tour = (window as unknown as { vtDemo: { tour: { goTo(i: number): Promise<void> } } }).vtDemo.tour;
        return tour.goTo(1);
      });
      await expect(popover(page)).toBeVisible();
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(dir as string, `${testInfo.project.name}-${id}-${theme}.png`) });
    }
  }
});
