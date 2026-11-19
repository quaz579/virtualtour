import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Tour = { advance(): void; forward(): Promise<unknown>; backward(): Promise<unknown>; finish(): unknown; start(): Promise<unknown> };
type Engine = { updatePopover(patch: Record<string, string>): void; nudge(arg: string | Record<string, string>): void };
type Win = { vtTour: Tour; vtEngine: () => Engine; vtLog: string[]; vtPayload: string; __vtPwned?: number };

const popover = (page: Page) => page.locator(".vt-popover");
const log = (page: Page) => page.evaluate(() => (window as unknown as Win).vtLog);
const pwned = (page: Page) => page.evaluate(() => (window as unknown as Win).__vtPwned);
const settle = (page: Page) => page.waitForTimeout(400);
const executable = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".vt-popover, .vt-popover *")).flatMap((el) => {
      const hits: string[] = [];
      if (el.tagName.toLowerCase() === "script") hits.push("script");
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.toLowerCase().startsWith("on")) hits.push(attr.name);
        if (/^\s*javascript:/i.test(attr.value)) hits.push(`${attr.name}=javascript:`);
      }
      return hits;
    }),
  );

async function open(page: Page, query = "") {
  await page.goto(`/fixtures/sanitize.html${query}`);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
  await expect.poll(() => log(page)).toContain("shown:first");
}

test("payloads in title, body, instruction, counter and labels never execute", async ({ page }) => {
  await open(page);
  await settle(page);
  expect(await pwned(page)).toBeUndefined();
  expect(await executable(page)).toEqual([]);
  await expect(page.locator(".vt-popover-title")).toContainText("ok");
  await expect(page.locator(".vt-popover-instruction-text")).toContainText("ok");
  await expect(page.locator(".vt-popover-progress-text")).toContainText("ok");
});

test("payloads in a string array body never execute", async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as Win).vtTour.advance());
  await expect.poll(() => log(page)).toContain("shown:array");
  await settle(page);
  expect(await pwned(page)).toBeUndefined();
  expect(await executable(page)).toEqual([]);
  await expect(page.locator(".vt-popover-description p")).toHaveCount(2);
});

test("payloads in updatePopover and nudge patches and feedback never execute", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const engine = (window as unknown as Win).vtEngine()!;
    const p = (window as unknown as Win).vtPayload;
    engine.updatePopover({
      title: p,
      description: p,
      instruction: p,
      progressText: p,
      nextBtnText: p,
      prevBtnText: p,
      closeBtnLabel: p,
    });
    engine.nudge({ instruction: p, title: p });
    engine.nudge(p);
  });
  await settle(page);
  expect(await pwned(page)).toBeUndefined();
  expect(await executable(page)).toEqual([]);
  await expect(page.locator(".vt-popover-feedback")).toContainText("ok");
});

test("control: the same payload executes when no sanitizer is configured", async ({ page }) => {
  await open(page, "?raw");
  await expect.poll(() => pwned(page)).toBeGreaterThan(0);
});

test("a user Element body and a DocumentFragment body survive close and a second mount", async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as Win).vtTour.advance());
  await expect.poll(() => log(page)).toContain("shown:array");
  await page.evaluate(() => void (window as unknown as Win).vtTour.forward());
  await expect.poll(() => log(page)).toContain("shown:element");
  await expect(page.locator(".vt-body")).toHaveText("Original element body");
  await expect(page.locator(".demo-container > #orig-body")).toHaveText("Original element body");
  await page.evaluate(() => void (window as unknown as Win).vtTour.forward());
  await expect.poll(() => log(page)).toContain("shown:fragment");
  await expect(page.locator(".vt-body .fragment-note")).toHaveText("Fragment body");
  await page.evaluate(() => void (window as unknown as Win).vtTour.finish());
  await expect(popover(page)).toHaveCount(0);
  await expect(page.locator(".demo-container > #orig-body")).toHaveText("Original element body");
  await page.evaluate(() => void (window as unknown as Win).vtTour.start());
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).vtLog.filter((l) => l === "shown:first").length)).toBe(2);
  await expect.poll(() => log(page)).toContain("shown:first");
  const shownCount = (id: string) => page.evaluate((name) => (window as unknown as Win).vtLog.filter((l) => l === name).length, `shown:${id}`);
  await page.evaluate(() => (window as unknown as Win).vtTour.advance());
  await expect.poll(() => shownCount("array")).toBe(2);
  await page.evaluate(() => void (window as unknown as Win).vtTour.forward());
  await expect.poll(() => shownCount("element")).toBe(2);
  await expect(page.locator(".vt-body")).toHaveText("Original element body");
  await page.evaluate(() => void (window as unknown as Win).vtTour.forward());
  await expect(page.locator(".vt-body .fragment-note")).toHaveText("Fragment body");
});
