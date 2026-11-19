import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

const popover = (page: Page) => page.locator(".vt-popover");

async function open(page: Page, query = "") {
  await page.goto(`/fixtures/theme.html${query}`);
  await page.locator("html[data-ready=true]").waitFor();
  await page.locator("#start").focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
}

type Rgb = [number, number, number];

function parseColor(value: string): Rgb {
  const match = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(value);
  if (!match) throw new Error(`unparseable color ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), prop);

async function colors(page: Page) {
  return {
    text: parseColor(await style(page, ".vt-popover", "color")),
    background: parseColor(await style(page, ".vt-popover", "background-color")),
    muted: parseColor(await style(page, ".vt-popover-progress-text", "color")),
  };
}

async function tabTo(page: Page, selector: string) {
  for (let index = 0; index < 12; index += 1) {
    if (await page.evaluate((target) => document.activeElement?.matches(target) ?? false, selector)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${selector}`);
}

test("base.css alone gives a boxed, readable popover and sets the marker", async ({ page }) => {
  await open(page, "?plain");
  expect(await style(page, ".vt-popover", "--vt-base")).toBe("1");
  expect(await style(page, ".vt-popover", "box-shadow")).not.toBe("none");
  expect(await style(page, ".vt-popover", "padding-top")).toBe("15px");
  expect(await style(page, ".vt-popover", "border-top-left-radius")).toBe("5px");
  const { text, background } = await colors(page);
  expect(background).toEqual([255, 255, 255]);
  expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  expect(await style(page, ".vt-popover-next-btn", "border-top-width")).toBe("1px");
});

test("theme light: text and muted text pass 4.5:1 and the primary button passes too", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  const { text, background, muted } = await colors(page);
  expect(background).toEqual([255, 255, 255]);
  expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
  const buttonText = parseColor(await style(page, ".vt-popover-next-btn", "color"));
  const buttonBackground = parseColor(await style(page, ".vt-popover-next-btn", "background-color"));
  expect(contrast(buttonText, buttonBackground)).toBeGreaterThanOrEqual(4.5);
  await testInfo.attach("theme-light", { body: await page.screenshot(), contentType: "image/png" });
});

test("theme dark through prefers-color-scheme: colors switch and still pass", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  const { text, background, muted } = await colors(page);
  expect(luminance(background)).toBeLessThan(0.1);
  expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
  const buttonText = parseColor(await style(page, ".vt-popover-next-btn", "color"));
  const buttonBackground = parseColor(await style(page, ".vt-popover-next-btn", "background-color"));
  expect(contrast(buttonText, buttonBackground)).toBeGreaterThanOrEqual(4.5);
  await testInfo.attach("theme-dark", { body: await page.screenshot(), contentType: "image/png" });
});

test("data-vt-theme overrides the system scheme in both directions", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, "?theme=light");
  expect(parseColor(await style(page, ".vt-popover", "background-color"))).toEqual([255, 255, 255]);

  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "?theme=dark");
  expect(luminance(parseColor(await style(page, ".vt-popover", "background-color")))).toBeLessThan(0.1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the focus ring on a keyboard-focused .vt-button is 2px, solid and 3:1 against the ${scheme} background`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await page.keyboard.press("Tab");
    await popover(page).getByRole("button", { name: "Next" }).click();
    await expect(popover(page).locator(".vt-button").first()).toBeVisible();
    await tabTo(page, ".vt-button");
    const outline = await page.locator(".vt-button:focus-visible").evaluate((element) => {
      const computed = getComputedStyle(element);
      return { style: computed.outlineStyle, width: computed.outlineWidth, color: computed.outlineColor };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    const { background } = await colors(page);
    expect(contrast(parseColor(outline.color), background)).toBeGreaterThanOrEqual(3);
  });
}

test("a keyboard-focused close button gets the ring", async ({ page }) => {
  await open(page);
  await tabTo(page, ".vt-popover-close-btn");
  expect(await page.locator(".vt-popover-close-btn:focus-visible").evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("2px");
});

for (const scheme of ["light", "dark"] as const) {
  test(`the arrow follows the ${scheme} popover background`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    const arrow = parseColor(await style(page, ".vt-popover-arrow", "border-top-color").then(async (top) => (top.includes("0, 0, 0, 0") ? style(page, ".vt-popover-arrow", "border-bottom-color") : top)));
    expect(arrow).toEqual((await colors(page)).background);
  });
}

test("a keyboard-focused engine footer button also gets the ring", async ({ page }) => {
  await open(page);
  await tabTo(page, ".vt-popover-footer-btn");
  expect(await page.locator(".vt-popover-footer-btn:focus-visible").evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("2px");
});

test("variables restyle the popover", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const css = document.createElement("style");
      css.textContent = ":root { --vt-accent: rgb(200, 0, 0); --vt-radius: 20px; --vt-space: 30px; }";
      document.head.appendChild(css);
    });
  });
  await open(page);
  expect(parseColor(await style(page, ".vt-popover-next-btn", "background-color"))).toEqual([200, 0, 0]);
  expect(await style(page, ".vt-popover", "border-top-left-radius")).toBe("20px");
  expect(await style(page, ".vt-popover", "padding-top")).toBe("30px");
});

test("a plain :root override wins in OS dark mode too", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const css = document.createElement("style");
      css.textContent = ":root { --vt-accent: rgb(0, 150, 0); }";
      document.head.appendChild(css);
    });
  });
  await open(page);
  expect(parseColor(await style(page, ".vt-popover-next-btn", "background-color"))).toEqual([0, 150, 0]);
});

test("the entrance animation runs under no-preference and is absent under reduced motion", async ({ page }) => {
  const slow = () =>
    page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const css = document.createElement("style");
        css.textContent = "html:root { --vt-enter-duration: 4s; }";
        document.head.appendChild(css);
      });
    });
  const names = () => page.evaluate(() => document.getAnimations().map((animation) => (animation as CSSAnimation).animationName ?? ""));

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await slow();
  await open(page, "?animate=1");
  await expect.poll(names).toContain("vt-enter");
});

test("reduced motion leaves document.getAnimations() empty right after start()", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const css = document.createElement("style");
      css.textContent = "html:root { --vt-enter-duration: 4s; }";
      document.head.appendChild(css);
    });
  });
  await open(page, "?animate=1");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("position.arrow false adds vt-no-arrow and hides the arrow, and the arrow shows without it", async ({ page }) => {
  await open(page);
  expect(await style(page, ".vt-popover-arrow", "display")).not.toBe("none");
  await open(page, "?noarrow");
  expect(await style(page, ".vt-popover-arrow", "display")).toBe("none");
  await expect(popover(page)).toHaveClass(/vt-no-arrow/);
});

test("the progress bar width follows the progress variables", async ({ page }) => {
  await open(page);
  await popover(page).evaluate((element) => {
    element.setAttribute("data-vt-progress-bar", "");
    element.style.setProperty("--vt-progress-index", "1");
    element.style.setProperty("--vt-progress-total", "2");
  });
  const widths = await popover(page).evaluate((element) => ({
    bar: parseFloat(getComputedStyle(element, "::after").width),
    box: element.getBoundingClientRect().width,
  }));
  expect(Math.abs(widths.bar - widths.box / 2)).toBeLessThanOrEqual(1.5);
});
