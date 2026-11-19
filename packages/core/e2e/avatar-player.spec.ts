import { expect, test } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

type Sample = { t: number; pos: string };
type Sampled = { samples: Sample[]; resolvedAt: number };
type Win = {
  vtPlayer: { play(name: string): Promise<void>; still(name: string): void; current: string | null };
  vtSample(run: () => Promise<void>): Promise<Sampled>;
  vtMakePlayer(sheet: string): { el: HTMLElement };
};

const FRAME = 32;
const MARCH_ROW = 1;
const validOffsets = [0, 1, 2, 3].map((col) => `${-col * FRAME}px ${-MARCH_ROW * FRAME}px`.replace(/^-?0px/, "0px"));
const normalize = (pos: string): string => pos.replace(/^-0px/, "0px").replace(/ -0px$/, " 0px");
const stillOffset = validOffsets[3];

async function open(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/fixtures/avatar-player.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
}

test("plays a 4-frame animation through valid frame offsets and ends on the still frame", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(() => {
    const w = window as unknown as Win;
    return w.vtSample(() => w.vtPlayer.play("march"));
  });
  const seen = result.samples.map((s) => normalize(s.pos));
  for (const pos of seen) expect(validOffsets).toContain(pos);
  const indexes = seen.map((pos) => validOffsets.indexOf(pos));
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  expect(new Set(indexes).size).toBeGreaterThanOrEqual(2);
  expect(seen[seen.length - 1]).toBe(stillOffset);
  expect(result.resolvedAt).toBeGreaterThanOrEqual(4 * 120 - 20);
  expect(await page.evaluate(() => (window as unknown as Win).vtPlayer.current)).toBeNull();
});

test("a loop stays valid and stop() returns to the rest frame", async ({ page }) => {
  await open(page);
  const rest = await page.evaluate(async () => {
    const w = window as unknown as Win & { vtEl: HTMLElement };
    const started = w.vtPlayer.play("think");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const running = w.vtPlayer.current;
    (w.vtPlayer as unknown as { stop(): void }).stop();
    await started;
    return { running, pos: w.vtEl.style.backgroundPosition };
  });
  expect(rest.running).toBe("think");
  expect(normalize(rest.pos)).toBe("0px 0px");
});

test("reduced motion shows the still frame and never changes the position", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const result = await page.evaluate(() => {
    const w = window as unknown as Win;
    return w.vtSample(async () => {
      await w.vtPlayer.play("march");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
  });
  const seen = new Set(result.samples.map((s) => normalize(s.pos)));
  expect(seen.size).toBe(1);
  expect(Array.from(seen)).toEqual([stillOffset]);
});

test("a sheet URL with quotes still produces a valid background image", async ({ page }) => {
  await open(page);
  const image = await page.evaluate(() => {
    const w = window as unknown as Win;
    const { el } = w.vtMakePlayer("/sheet.png?a='b\"c)d\\e");
    return el.style.backgroundImage;
  });
  expect(image).toContain("sheet.png");
  expect(image).toContain("url(");
});
