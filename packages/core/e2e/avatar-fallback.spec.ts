import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Win = { vtFallbackRun(options: Record<string, unknown>): Promise<void>; vtFallbackErrors: string[] };

interface Logs {
  warnings: string[];
  errors: string[];
  pageErrors: string[];
}

function watch(page: Page): Logs {
  const logs: Logs = { warnings: [], errors: [], pageErrors: [] };
  page.on("console", (message: ConsoleMessage) => {
    const text = message.text();
    if (message.type() === "warning" && text.includes("[virtualtour]")) logs.warnings.push(text);
    if (message.type() === "error" && !text.includes("Failed to load resource")) logs.errors.push(text);
  });
  page.on("pageerror", (error) => logs.pageErrors.push(error.message));
  return logs;
}

async function open(page: Page): Promise<void> {
  await page.goto("/fixtures/avatar-fallback.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

const run = (page: Page, options: Record<string, unknown>) => page.evaluate((o) => (window as unknown as Win).vtFallbackRun(o), options);
const errors = (page: Page) => page.evaluate(() => (window as unknown as Win).vtFallbackErrors);
const title = (page: Page) => page.locator(".vt-popover-title");
const popover = (page: Page) => page.locator(".vt-popover");

for (const mode of ["pack-404", "sheet-404"] as const) {
  test(`a tour whose ${mode === "pack-404" ? "pack file" : "sheet image"} 404s runs as dialogs with one warning and no error`, async ({ page }) => {
    const logs = watch(page);
    await open(page);
    await run(page, { mode });
    await expect(title(page)).toHaveText("First");
    await expect(popover(page)).toHaveClass(/vt-dialog/);
    await expect(page.locator(".vt-avatar")).toHaveCount(0);
    await page.locator(".vt-popover-next-btn").click();
    await expect(title(page)).toHaveText("Second");
    await expect(popover(page)).toHaveClass(/vt-dialog/);
    expect(await errors(page)).toHaveLength(1);
    expect(logs.warnings.filter((text) => text.includes("Avatar pack unavailable"))).toHaveLength(1);
    expect(logs.errors).toEqual([]);
    expect(logs.pageErrors).toEqual([]);
  });
}

test("a pack that arrives within loadTimeoutMs shows the first step as a speaker", async ({ page }) => {
  await open(page);
  await run(page, { mode: "delayed", delayMs: 1000, loadTimeoutMs: 4000 });
  await expect(title(page)).toHaveText("First");
  await expect(popover(page)).toHaveClass(/vt-speaker/);
  expect(await errors(page)).toEqual([]);
});

test("a pack slower than loadTimeoutMs starts as a dialog and reports once", async ({ page }) => {
  watch(page);
  await open(page);
  await run(page, { mode: "delayed", delayMs: 1000, loadTimeoutMs: 300 });
  await expect(title(page)).toHaveText("First");
  await expect(popover(page)).toHaveClass(/vt-dialog/);
  await page.locator(".vt-popover-next-btn").click();
  await expect(title(page)).toHaveText("Second");
  await expect(popover(page)).toHaveClass(/vt-dialog/);
  expect(await errors(page)).toHaveLength(1);
});

test("the sheet is requested once for a raw pack", async ({ page }) => {
  const sheets: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/test-pack/sheet.png")) sheets.push(request.url());
  });
  await open(page);
  await run(page, { mode: "ok" });
  await expect(popover(page)).toHaveClass(/vt-speaker/);
  await expect(page.locator(".vt-avatar")).toBeVisible();
  expect(sheets.length).toBe(1);
});

test("an avatar tour completes with the keyboard alone, and the avatar never takes focus or speech", async ({ page }) => {
  await open(page);
  await run(page, { mode: "ok" });
  await expect(popover(page)).toHaveClass(/vt-speaker/);
  await expect(popover(page)).toHaveAttribute("role", "dialog");
  await expect(page.locator(".vt-avatar")).toHaveAttribute("aria-hidden", "true");
  expect(await page.locator(".vt-avatar").evaluate((el) => el.querySelectorAll("a[href],button,input,select,textarea,[tabindex]").length)).toBe(0);
  expect(await page.locator(".vt-avatar").evaluate((el) => el.hasAttribute("tabindex"))).toBe(false);
  const press = async (): Promise<void> => {
    for (let tabs = 0; tabs < 6; tabs += 1) {
      if (await page.locator(".vt-popover-next-btn").evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(page.locator(".vt-popover-next-btn")).toBeFocused();
    await page.keyboard.press("Enter");
  };
  for (const expected of ["Second", "Third", "Fourth"]) {
    await press();
    await expect(title(page)).toHaveText(expected);
    await expect(popover(page)).toHaveClass(/vt-speaker/);
  }
  await press();
  await expect(popover(page)).toHaveCount(0);
});

test("the live region announces the new title after configure()", async ({ page }) => {
  await open(page);
  await run(page, { mode: "ok" });
  await expect(title(page)).toHaveText("First");
  await page.evaluate(() => {
    const tour = (window as unknown as { vtFallbackTour: { stepById(id: string): { configure(p: object): void } } }).vtFallbackTour;
    tour.stepById("one").configure({ title: "Renamed" });
  });
  await expect(title(page)).toHaveText("Renamed");
  await expect(page.locator("[aria-live]")).toContainText("Renamed");
});
