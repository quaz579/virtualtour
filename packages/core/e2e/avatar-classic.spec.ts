import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Kind = "classic-a" | "classic-b" | "v1" | "thumbtack" | "thumbtack-dist" | "thumbtack-bundle";
type Win = {
  vtClassicRun(kind: Kind): Promise<void>;
  vtClassicSample(animation: string): Promise<{ t: number; pos: string }[]>;
};

async function open(page: Page): Promise<void> {
  await page.goto("/fixtures/avatar-classic.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

const run = (page: Page, kind: Kind) => page.evaluate((k) => (window as unknown as Win).vtClassicRun(k), kind);
const sample = (page: Page, animation: string) => page.evaluate((a) => (window as unknown as Win).vtClassicSample(a), animation);
const avatar = (page: Page) => page.locator(".vt-avatar");
const title = (page: Page) => page.locator(".vt-popover-title");
const normalize = (pos: string): string => pos.replace(/(^|\s)-0px/g, "$10px");

async function twoStepTour(page: Page): Promise<void> {
  await expect(title(page)).toHaveText("First");
  await expect(avatar(page)).toBeVisible();
  await page.locator(".vt-popover-next-btn").click();
  await expect(title(page)).toHaveText("Second");
  await expect(avatar(page)).toBeVisible();
}

for (const [kind, label] of [
  ["classic-a", "column/row"],
  ["classic-b", "pixel-position"],
] as const) {
  test(`the ${label} classic map loads and a two-step tour plays its animations`, async ({ page }) => {
    await open(page);
    await run(page, kind);
    await twoStepTour(page);

    const samples = await sample(page, "Wave");
    const positions = samples.map((s) => normalize(s.pos));
    const distinct = new Set(positions);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    for (const pos of distinct) expect(["0px 0px", "-32px 0px", "-64px 0px", "-96px 0px"]).toContain(pos);
    expect(positions[positions.length - 1]).toBe("-96px 0px");
  });
}

test("both classic formats produce the same frames and roles", async ({ page }) => {
  await open(page);
  await run(page, "classic-a");
  const a = await page.evaluate(() => {
    const pack = (window as unknown as { vtClassicPack: { frames: unknown; roles: unknown; license: unknown } }).vtClassicPack;
    return { frames: pack.frames, roles: pack.roles, license: pack.license };
  });
  await run(page, "classic-b");
  const b = await page.evaluate(() => {
    const pack = (window as unknown as { vtClassicPack: { frames: unknown; roles: unknown; license: unknown } }).vtClassicPack;
    return { frames: pack.frames, roles: pack.roles, license: pack.license };
  });
  expect(b).toEqual(a);
  expect(a.license).toEqual({ name: "unknown", attribution: "Supplied by the integrator" });
});

test("a v1 pack loads from a URL and runs the tour", async ({ page }) => {
  await open(page);
  await run(page, "v1");
  await twoStepTour(page);
});

test("the built avatar bundle resolves thumbtackPack() to the dist folder next to it", async ({ page }) => {
  await open(page);
  await run(page, "thumbtack-bundle");
  const sheet = await page.evaluate(() => (window as unknown as { vtClassicPack: { sheetUrl: string } }).vtClassicPack.sheetUrl);
  expect(sheet).toMatch(/\/dist\/thumbtack\/sheet\.png$/);
  await twoStepTour(page);
});

for (const kind of ["thumbtack", "thumbtack-dist"] as const) {
  test(`thumbtackPack() loads ${kind === "thumbtack" ? "from the module folder" : "from the built dist"} and the character is visible`, async ({ page }, testInfo) => {
    await open(page);
    await run(page, kind);
    await twoStepTour(page);
    const box = await avatar(page).boundingBox();
    expect(box?.width).toBeGreaterThan(20);
    expect(box?.height).toBeGreaterThan(20);
    const image = await avatar(page).evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(image).toMatch(/thumbtack\/sheet\.png/);
    if (kind === "thumbtack-dist") expect(image).toContain("/dist/thumbtack/sheet.png");
    await testInfo.attach(`thumbtack-${testInfo.project.name}.png`, { body: await page.screenshot(), contentType: "image/png" });
  });
}
