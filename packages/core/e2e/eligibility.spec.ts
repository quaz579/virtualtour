import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Win = { vtLog: string[]; vtMarks: Record<string, number>; vtLiveObservers: () => number };

const popover = (page: Page) => page.locator(".vt-popover");
const log = (page: Page) => page.evaluate(() => (window as unknown as Win).vtLog);
const marks = (page: Page) => page.evaluate(() => (window as unknown as Win).vtMarks);
const liveObservers = (page: Page) => page.evaluate(() => (window as unknown as Win).vtLiveObservers());
const currentTarget = (page: Page) =>
  page.evaluate(() => {
    const tour = (window as unknown as { vtTour: { currentStep: { resolvedTarget: Element | null } | null } }).vtTour;
    return tour.currentStep?.resolvedTarget?.id ?? null;
  });

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
}

test("a target inserted after 800 ms attaches within a second and start() resolves after attachment", async ({ page }) => {
  await open(page, "/fixtures/late-target.html?delay=800&waitFor=3000");
  await expect.poll(() => log(page)).toContain("started:attached");
  const m = await marks(page);
  expect(m["started"]).toBeGreaterThanOrEqual(m["attached"] ?? Infinity);
  expect((m["started"] ?? Infinity) - (m["attached"] ?? 0)).toBeLessThan(1000);
  await expect(popover(page)).toBeVisible();
  expect(await currentTarget(page)).toBe("late-target");
});

test("a target that never appears centers the step after about the wait", async ({ page }) => {
  await open(page, "/fixtures/late-target.html?never=1&waitFor=500");
  await expect.poll(() => log(page)).toContain("started:absent");
  const m = await marks(page);
  const waited = (m["started"] ?? 0) - (m["clicked"] ?? 0);
  expect(waited).toBeGreaterThanOrEqual(450);
  expect(waited).toBeLessThan(2500);
  await expect(popover(page)).toBeVisible();
  expect(await currentTarget(page)).toBeNull();
  const box = await popover(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - (viewport?.width ?? 0) / 2)).toBeLessThan(80);
});

test("a skip step whose target never appears is skipped", async ({ page }) => {
  await open(page, "/fixtures/late-target.html?never=1&waitFor=500&skip=1");
  await expect.poll(() => log(page)).toContain("shown:end");
  expect(await log(page)).not.toContain("shown:late");
});

test("no mutation observer stays live after an exit during a wait or after the tour ends", async ({ page }) => {
  await open(page, "/fixtures/late-target.html?never=1&waitFor=5000");
  await expect.poll(() => liveObservers(page)).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { vtTour: { exit(): Promise<boolean> } }).vtTour.exit());
  await expect.poll(() => liveObservers(page)).toBe(0);
  await expect.poll(() => log(page)).toContain("exited:api");

  await open(page, "/fixtures/late-target.html?delay=100&waitFor=3000");
  await expect.poll(() => log(page)).toContain("started:attached");
  await page.evaluate(() => (window as unknown as { vtTour: { finish(): void } }).vtTour.finish());
  await expect.poll(() => liveObservers(page)).toBe(0);
});

test("forward skips a missing skip step and backward comes back over it", async ({ page }) => {
  await open(page, "/fixtures/skip.html");
  await expect.poll(() => log(page)).toContain("shown:one");
  await page.locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page)).toContain("shown:three");
  await page.locator(".vt-popover-prev-btn").click();
  await expect.poll(() => log(page)).toEqual(["shown:one", "shown:three", "shown:one"]);
});

test("the last visible step before a trailing skip step offers Done", async ({ page }) => {
  await open(page, "/fixtures/skip.html?trailing=1");
  await expect.poll(() => log(page)).toContain("shown:one");
  await expect(page.locator(".vt-popover-next-btn")).toHaveText("Done");
  await page.locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page)).toContain("finished");
  await expect(popover(page)).toHaveCount(0);
});

test("a prepare that opens a panel is too late for the same step's target and shows it centered", async ({ page }) => {
  await open(page, "/fixtures/prepare.html?mode=gotcha");
  await expect.poll(() => log(page)).toContain("shown:intro");
  await page.locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page)).toContain("shown:panel");
  await expect(page.locator("#panel")).toBeVisible();
  expect(await currentTarget(page)).toBeNull();
});

test("opening the panel in the step before attaches the next step to its target", async ({ page }) => {
  await open(page, "/fixtures/prepare.html?mode=cookbook");
  await expect.poll(() => log(page)).toContain("shown:open");
  await page.locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page)).toContain("shown:panel");
  expect(await currentTarget(page)).toBe("panel-btn");
});

test("a prepare that never settles times out with a warning and the step shows", async ({ page }) => {
  await open(page, "/fixtures/prepare.html?mode=hang");
  await expect.poll(() => log(page)).toContain("shown:intro");
  await page.locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page), { timeout: 4000 }).toContain("shown:stuck");
  const warnings = await page.evaluate(() => (window as unknown as { vtWarnings: string[] }).vtWarnings);
  expect(warnings.some((w) => w.includes("prepare did not settle within 400 ms"))).toBe(true);
  await page.locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page)).toContain("shown:after");
});

test("consecutive missing steps spend at most the wait budget", async ({ page }) => {
  await open(page, "/fixtures/late-target.html?never=1&waitFor=1000&skip=1&missing=4&waitBudget=1500");
  await expect.poll(() => log(page), { timeout: 8000 }).toContain("shown:end");
  const m = await marks(page);
  const waited = (m["started"] ?? 0) - (m["clicked"] ?? 0);
  expect(waited).toBeGreaterThanOrEqual(1400);
  expect(waited).toBeLessThan(3500);
});

test("a step shown centered after a wait timeout stays centered when its target appears later", async ({ page }) => {
  await open(page, "/fixtures/late-target.html?never=1&waitFor=300");
  await expect.poll(() => log(page)).toContain("started:absent");
  await page.evaluate(() => {
    const el = document.createElement("button");
    el.id = "late-target";
    el.textContent = "Late button";
    document.querySelector("#slot")?.appendChild(el);
  });
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: (viewport?.width ?? 1280) - 40, height: viewport?.height ?? 720 });
  await page.waitForTimeout(400);
  expect(await currentTarget(page)).toBeNull();
  const box = await popover(page).boundingBox();
  const width = (viewport?.width ?? 1280) - 40;
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThan(80);
});
