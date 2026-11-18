import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("SSR gate", () => {
  const saved = { window: globalThis.window, document: globalThis.document };

  beforeAll(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
  });

  afterAll(() => {
    if (saved.window !== undefined) Object.assign(globalThis, { window: saved.window });
    if (saved.document !== undefined) Object.assign(globalThis, { document: saved.document });
  });

  it("runs with no DOM globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it.each([
    ["public entry", "../src/index.ts"],
    ["engine", "../src/engine/driver.ts"],
    ["avatar entry", "../src/avatar/index.ts"],
    ["motion entry", "../src/motion/index.ts"],
  ])("imports the %s without throwing", async (_label, path) => {
    await expect(import(/* @vite-ignore */ path)).resolves.toBeDefined();
  });
});
