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

async function open(page: Page, tour: string, first: string, extra = "") {
  await page.goto(`/fixtures/a11y.html?tour=${tour}${extra}`);
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

for (const theme of ["light", "dark"]) {
  for (const tour of ["titled", "action", "buttons"]) {
    test(`the accessibility engine reports no violations on the ${tour} step in the ${theme} theme`, async ({ page }) => {
      await open(page, tour, tour, `&theme=${theme}`);
      const background = await popover(page).evaluate((el) => getComputedStyle(el).backgroundColor);
      const channels = background.match(/\d+/g)!.slice(0, 3).map(Number);
      const mean = channels.reduce((a, b) => a + b, 0) / 3;
      expect(theme === "dark" ? mean < 100 : mean > 200).toBe(true);
      expect(await violations(page)).toEqual([]);
    });
  }
}

test("the accessibility engine reports no violations when the system prefers a dark color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, "action", "action");
  expect(await violations(page)).toEqual([]);
});

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
  await expect.poll(() => log(page)).toContain("shown:s2");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => log(page)).toContain("shown:s3");
  await page.locator("#field").focus();
  await page.keyboard.type("ab");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(popover(page)).toBeVisible();
  expect(await log(page)).toEqual(["shown:s1", "shown:s2", "shown:s3"]);
});

test("arrows inside a widget within the target go to the app", async ({ page }) => {
  await page.goto("/fixtures/a11y.html");
  await page.locator("html[data-ready=true]").waitFor();
  await page.evaluate(() => {
    const tour = window.vtBuild("four");
    tour.steps[0]!.configure({ target: "#widget" });
    void tour.start();
  });
  await expect.poll(() => log(page)).toContain("shown:s1");
  await page.locator("#widget-input").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(popover(page)).toBeVisible();
  expect(await log(page)).toEqual(["shown:s1"]);
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

async function countStageUpdates(page: Page): Promise<number> {
  await page.evaluate(() => {
    const w = window as unknown as { vtStage: number };
    w.vtStage = 0;
    new MutationObserver((records) => {
      w.vtStage += records.length;
    }).observe(document.querySelector("[data-vt-overlay] path")!, { attributes: true, attributeFilter: ["d"] });
  });
  await page.keyboard.press("Enter");
  await expect.poll(() => log(page)).toContain("shown:m2");
  await page.waitForTimeout(800);
  return page.evaluate(() => (window as unknown as { vtStage: number }).vtStage);
}

test("without a reduced motion preference the stage tweens between steps and the popover fades", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "motion", "m1");
  expect(await page.evaluate(() => document.body.hasAttribute("data-vt-fade"))).toBe(true);
  expect(await countStageUpdates(page)).toBeGreaterThan(5);
});

test("reduced motion runs in simple mode: no fade, no stage tween, no running animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "motion", "m1");
  const flags = () =>
    page.evaluate(() => ({
      simple: document.body.classList.contains("vt-simple"),
      fadeClass: document.body.classList.contains("vt-fade"),
      fadeAttribute: document.body.hasAttribute("data-vt-fade"),
      animations: document.getAnimations().length,
    }));
  expect(await flags()).toEqual({ simple: true, fadeClass: false, fadeAttribute: false, animations: 0 });
  expect(await countStageUpdates(page)).toBeLessThanOrEqual(2);
  expect(await flags()).toEqual({ simple: true, fadeClass: false, fadeAttribute: false, animations: 0 });
});

test("reduced motion makes the nudge flash instead of shake", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "action", "action");
  await page.evaluate(() => {
    const w = window as unknown as { vtAnims: { name: string; transform: boolean }[] };
    w.vtAnims = [];
    new MutationObserver(() => {
      for (const a of document.getAnimations()) {
        w.vtAnims.push({
          name: (a as CSSAnimation).animationName ?? "",
          transform: (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => "transform" in k) ?? false,
        });
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.evaluate(() => window.vtTour.nudge());
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { vtAnims: { name: string }[] }).vtAnims.some((a) => a.name === "vt-nudge-flash")))
    .toBe(true);
  expect(await page.evaluate(() => (window as unknown as { vtAnims: { transform: boolean }[] }).vtAnims.filter((a) => a.transform))).toEqual([]);
});

test("the popover stays inside the viewport and operable in a 640x400 viewport (a 1280x800 window at 200% zoom)", async ({ page }) => {
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

test.describe("live region", () => {
  const region = (page: Page) => page.locator(".vt-live-region");

  test("is polite and atomic, and stays silent when the first step shows", async ({ page }) => {
    await open(page, "live", "l1");
    await expect(region(page)).toHaveAttribute("aria-live", "polite");
    await expect(region(page)).toHaveAttribute("aria-atomic", "true");
    await expect(region(page)).toHaveText("");
  });

  test("announces a new title and a new body after configure(), and nothing for a change that has no text", async ({ page }) => {
    await open(page, "live", "l1");
    await page.evaluate(() => window.vtTour.steps[0]!.configure({ title: "Renamed step" }));
    await expect(region(page)).toHaveText("Renamed step");
    await expect(page.getByRole("dialog", { name: "Renamed step" })).toBeVisible();
    await page.evaluate(() => window.vtTour.steps[0]!.configure({ body: "Fresh body text." }));
    await expect(region(page)).toHaveText("Fresh body text.");
    await page.evaluate(() => window.vtTour.steps[0]!.configure({ classes: "extra" }));
    await expect(region(page)).toHaveText("Fresh body text.");
  });

  test("announces action step feedback, then the done text while the advance delay runs", async ({ page }) => {
    await open(page, "live", "l1");
    await page.keyboard.press("Enter");
    await expect.poll(() => log(page)).toContain("shown:l2");
    await page.evaluate(() => window.vtTour.nudge("Not that one"));
    await expect(region(page)).toHaveText("Not that one");
    await page.locator("#t3").click();
    await expect(region(page)).toHaveText("Done");
    await expect(popover(page).getByText("Live two")).toBeVisible();
    await expect.poll(() => log(page)).toContain("shown:l3");
  });

  test("does not announce a step when it first shows", async ({ page }) => {
    await open(page, "live", "l1");
    await page.keyboard.press("Enter");
    await expect.poll(() => log(page)).toContain("shown:l2");
    await expect(region(page)).toHaveText("");
  });
});

test.describe("avatar presenter", () => {
  async function openLayout(page: Page, query: string, options: object = {}) {
    await page.goto(`/fixtures/avatar-layout.html${query}`);
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    await page.evaluate((o) => (window as unknown as { vtRun(o: object): Promise<void> }).vtRun(o), options);
    await expect(page.locator(".vt-bubble .vt-popover-title")).toHaveText("Speaker title");
    await expect(page.locator(".vt-avatar")).toBeVisible();
  }

  const layouts: [string, string, object, "light" | "dark"][] = [
    ["the speaker layout", "", {}, "light"],
    ["the speaker layout docked at the start with a spotlight", "", { dock: "start", dim: true }, "light"],
    ["the speaker layout in the light theme", "?theme", {}, "light"],
    ["the speaker layout with a dark system preference", "?theme", {}, "dark"],
    ["the speaker layout in a right-to-left page", "?rtl", { side: "left" }, "light"],
  ];
  for (const [name, query, options, scheme] of layouts) {
    test(`the accessibility engine reports no violations on ${name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openLayout(page, query, options);
      expect(await violations(page)).toEqual([]);
    });
  }

  test("the speaker bubble is a named dialog and the avatar image is hidden from assistive technology", async ({ page }) => {
    await openLayout(page, "");
    await expect(page.getByRole("dialog", { name: "Speaker title" })).toBeVisible();
    const hidden = await page.locator(".vt-avatar").evaluate((el) => el.closest("[aria-hidden=true]") !== null || el.getAttribute("role") === "presentation");
    expect(hidden).toBe(true);
  });

  for (const kind of ["classic-a", "v1"]) {
    test(`the accessibility engine reports no violations on a ${kind} avatar tour`, async ({ page }) => {
      await page.goto("/fixtures/avatar-classic.html");
      await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
      await page.evaluate((k) => (window as unknown as { vtClassicRun(k: string): Promise<void> }).vtClassicRun(k), kind);
      await expect(page.locator(".vt-popover-title")).toHaveText("First");
      await expect(page.locator(".vt-avatar")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }
});
