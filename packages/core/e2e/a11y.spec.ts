import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const axeSource = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const popover = (page: Page) => page.locator(".vt-popover");
const log = (page: Page) => page.evaluate(() => window.vtLog);
const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
const focusedClass = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.className ?? "");

async function open(page: Page, tour: string, first: string) {
  await page.goto(`/fixtures/a11y.html?tour=${tour}`);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
  await expect.poll(() => log(page)).toContain(`shown:${first}`);
}

async function violations(page: Page) {
  await page.addScriptTag({ path: axeSource });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: { id: string; nodes: { target: unknown[]; html: string }[] }[] }> } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.html.slice(0, 160)) }));
  });
}

const scenarios: [string, string, string][] = [
  ["a titled step", "titled", "titled"],
  ["an untitled labeled step", "untitled", "untitled"],
  ["a centered step", "centered", "centered"],
  ["a spotlit step", "spotlit", "spotlit"],
  ["an action step", "action", "action"],
  ["a step with custom buttons and an element body", "buttons", "buttons"],
];

for (const [name, tour, first] of scenarios) {
  test(`the accessibility engine reports no violations on ${name}`, async ({ page }) => {
    await open(page, tour, first);
    await expect(page.locator(".vt-live-region")).toBeAttached();
    expect(await violations(page)).toEqual([]);
  });
}

test("the dialog is named and described by its parts", async ({ page }) => {
  await open(page, "action", "action");
  const dialog = page.getByRole("dialog", { name: "Action step" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-describedby", /vt-popover-description/);
  await expect(dialog).toHaveAttribute("aria-describedby", /vt-popover-instruction-text/);
  await expect(page.locator(".vt-popover-close-btn")).toHaveAccessibleName(/\S/);
  await expect(page.locator(".vt-popover-next-btn")).toHaveAccessibleName(/\S/);
});

test("keyboard alone completes a four-step tour and returns focus to the trigger", async ({ page }) => {
  await open(page, "four", "s1");
  for (const id of ["s2", "s3", "s4"]) {
    expect(await focusedClass(page)).toContain("vt-popover-next-btn");
    await page.keyboard.press("Enter");
    await expect.poll(() => log(page)).toContain(`shown:${id}`);
  }
  await expect(popover(page).locator(".vt-popover-next-btn")).toHaveText("Done");
  await page.keyboard.press("Enter");
  await expect.poll(() => log(page)).toContain("deactivated");
  await expect(popover(page)).toHaveCount(0);
  expect(await focusedId(page)).toBe("start");
});

test("arrows navigate and Escape exits, returning focus to the trigger", async ({ page }) => {
  await open(page, "four", "s1");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => log(page)).toContain("shown:s2");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await log(page)).filter((entry) => entry === "shown:s1").length).toBe(2);
  await page.keyboard.press("Escape");
  await expect.poll(() => log(page)).toContain("deactivated");
  expect(await focusedId(page)).toBe("start");
});

test("arrows and Escape typed inside a field on the page go to the app, not the tour", async ({ page }) => {
  await open(page, "four", "s1");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => log(page)).toContain("shown:s3");
  await page.locator("#field").focus();
  await page.keyboard.type("ab");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(popover(page)).toBeVisible();
  expect(await log(page)).toEqual(["shown:s1", "shown:s2", "shown:s3"]);
});

test("Tab cycles close, buttons and target without leaving the tour, and Shift+Tab reverses", async ({ page }) => {
  await open(page, "buttons", "buttons");
  const seen = new Set<string>();
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    seen.add(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "none";
        if (el.closest(".vt-popover")) return el.classList.contains("vt-popover-close-btn") ? "close" : `popover:${el.textContent}`;
        return el.id || el.tagName;
      }),
    );
  }
  expect([...seen].sort()).toEqual(["close", "popover:Move on", "popover:Secondary", "t1"].sort());
  const before = await page.evaluate(() => document.activeElement?.textContent ?? "");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.textContent ?? "")).toBe(before);
});

test("keys.escape and keys.arrows can be switched off", async ({ page }) => {
  await open(page, "keysOff", "k1");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(popover(page)).toBeVisible();
  expect(await log(page)).toEqual(["shown:k1"]);
});

test("reduced motion leaves no running animation after start and after forward", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "motion", "m1");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.keyboard.press("Enter");
  await expect.poll(() => log(page)).toContain("shown:m2");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => document.body.classList.contains("vt-simple"))).toBe(true);
});

test("the popover stays inside the viewport and operable at 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await open(page, "four", "s1");
  const box = await popover(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(640);
  expect(box!.y + box!.height).toBeLessThanOrEqual(400);
  await popover(page).locator(".vt-popover-next-btn").click();
  await expect.poll(() => log(page)).toContain("shown:s2");
});

test("changing a step through configure() is announced in the live region", async ({ page }) => {
  await open(page, "titled", "titled");
  const region = page.locator(".vt-live-region");
  await expect(region).toHaveAttribute("aria-live", "polite");
  await page.evaluate(() => window.vtTour.steps[0]!.configure({ title: "Renamed step" }));
  await expect(region).toHaveText("Renamed step");
  await expect(page.getByRole("dialog", { name: "Renamed step" })).toBeVisible();
});
