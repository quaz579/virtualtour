import { expect, test } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name === "edge" && testInfo.project.metadata["edgeMissing"] === true,
    "msedge is not installed on this machine",
  );
});

test("fixture page exposes the engine and shows a popover", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");

  const hasFactory = await page.evaluate(
    () => typeof (window as unknown as { __engine: { createEngine: unknown } }).__engine.createEngine === "function",
  );
  expect(hasFactory).toBe(true);

  await page.evaluate(() => {
    const w = window as unknown as {
      __engine: { createEngine: (o: unknown) => { drive: () => void } };
    };
    w.__engine
      .createEngine({
        steps: [{ element: "#one", popover: { title: "One", description: "First button" } }],
      })
      .drive();
  });

  await expect(page.locator(".driver-popover")).toBeVisible();
  await expect(page.locator(".driver-popover-title")).toHaveText("One");
});
