import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const log = (page: Page) => page.evaluate(() => (window as unknown as { vtLog: string[] }).vtLog);
const popover = (page: Page) => page.locator(".vt-popover");
const NUDGE = /vt-popover-nudge/;

async function open(page: Page, query = "", text = "Click Save.") {
  await page.goto(`/fixtures/action-steps.html${query}`);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => log(page)).toContain("shown:save");
  await expect(page.locator(".vt-popover-instruction-text")).toHaveText(text);
}

test("Next on the gated step shakes the popover and does not move", async ({ page }) => {
  await open(page);
  await page.locator(".vt-popover-next-btn").click({ force: true });
  await expect(popover(page)).toHaveClass(NUDGE);
  await expect(popover(page)).not.toHaveClass(NUDGE, { timeout: 1000 });
  expect(await log(page)).toEqual(["shown:save"]);
});

test("clicking the real target completes and the next step shows after the delay", async ({ page }) => {
  await open(page);
  await page.locator("#save").click();
  await expect.poll(() => log(page)).toContain("completed:save");
  await expect(popover(page)).toHaveClass(/vt-popover-instruction-done/);
  expect(await log(page)).not.toContain("shown:after");
  const completedAt = Date.now();
  await expect.poll(() => log(page)).toContain("shown:after");
  expect(Date.now() - completedAt).toBeGreaterThanOrEqual(400);
  expect(await log(page)).toEqual(["shown:save", "completed:save", "shown:after"]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the nudge flashes and does not shake", async ({ page }) => {
    await open(page);
    await page.locator(".vt-popover-next-btn").click({ force: true });
    await expect(popover(page)).toHaveClass(NUDGE);
    const animations = await page.evaluate(() =>
      document.getAnimations().map((a) => ({
        name: (a as CSSAnimation).animationName ?? "",
        transform: (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => "transform" in k) ?? false,
      })),
    );
    expect(animations.some((a) => a.name === "vt-nudge-flash")).toBe(true);
    expect(animations.filter((a) => a.transform)).toEqual([]);
  });
});

test("a custom forward button nudges instead of skipping the gate, then the target completes it", async ({ page }) => {
  await open(page, "?mode=buttons");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(popover(page)).toHaveClass(NUDGE);
  expect(await log(page)).toEqual(["shown:save"]);
  await page.locator("#save").click();
  await expect.poll(() => log(page)).toContain("shown:after");
});

test("arrow keys nudge a gated step even though custom buttons hide Next", async ({ page }) => {
  await open(page, "?mode=buttons");
  await page.locator("body").click({ position: { x: 5, y: 5 }, force: true });
  await page.keyboard.press("ArrowRight");
  await expect(popover(page)).toHaveClass(NUDGE);
  expect(await log(page)).toEqual(["shown:save"]);
});

test("a page click matching autoAdvance.selector completes the step through the gate", async ({ page }) => {
  await open(page, "?mode=selector", "Click Other.");
  await page.locator("#other").click();
  await expect.poll(() => log(page)).toContain("completed:save");
  await expect.poll(() => log(page)).toContain("shown:after");
});
