import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAvatarPack, loadClassicAvatarPack, thumbtackPack } from "../../src/avatar/loaders";
import { AvatarPackError } from "../../src/avatar/pack";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "../../e2e/fixtures/test-pack");
const read = (name: string): string => readFileSync(join(fixtures, name), "utf8");
const thumbtack = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/avatar/thumbtack/pack.json"), "utf8");

const originalImage = globalThis.Image;
let imageSize = { w: 128, h: 128 };
let imageFails = false;
let requested: string[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = imageSize.w;
  naturalHeight = imageSize.h;
  set src(value: string) {
    requested.push(value);
    queueMicrotask(() => (imageFails ? this.onerror?.() : this.onload?.()));
  }
}

function respond(files: Record<string, string>, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    const body = files[new URL(url).pathname];
    if (body === undefined) return new Response("nope", { status: 404 });
    return new Response(body, { status });
  });
}

beforeEach(() => {
  imageSize = { w: 128, h: 128 };
  imageFails = false;
  requested = [];
  globalThis.Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = originalImage;
  vi.restoreAllMocks();
});

describe("loadAvatarPack", () => {
  it("fetches, validates, resolves the sheet against the pack URL and preloads it", async () => {
    const fetchMock = respond({ "/packs/a/pack.json": read("pack.json") });
    const pack = await loadAvatarPack("https://x.test/packs/a/pack.json", { fetch: fetchMock as never });
    expect(pack.sheetUrl).toBe("https://x.test/packs/a/sheet.png");
    expect(pack.frames["wave"]?.length).toBe(3);
    expect(requested).toEqual(["https://x.test/packs/a/sheet.png"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("resolves a relative pack URL against the page", async () => {
    const fetchMock = respond({ "/pack.json": read("pack.json") });
    const pack = await loadAvatarPack("/pack.json", { fetch: fetchMock as never });
    expect(pack.sheetUrl).toBe(new URL("/sheet.png", document.baseURI).href);
  });

  it("passes the abort signal to fetch and rethrows an abort untouched", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => Promise.reject(init?.signal?.reason));
    await expect(loadAvatarPack("https://x.test/p.json", { fetch: fetchMock as never, signal: controller.signal })).rejects.toBe(
      controller.signal.reason,
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it.each([
    ["an HTTP error", respond({}), /HTTP 404/],
    ["a network error", vi.fn(() => Promise.reject(new Error("offline"))), /offline/],
    ["invalid JSON", respond({ "/p.json": "{nope" }), /not valid JSON/],
  ])("wraps %s in an AvatarPackError", async (_label, fetchMock, message) => {
    const promise = loadAvatarPack("https://x.test/p.json", { fetch: fetchMock as never });
    await expect(promise).rejects.toBeInstanceOf(AvatarPackError);
    await expect(promise).rejects.toThrow(message);
  });

  it("rejects a pack that fails validation with the field path", async () => {
    const bad = JSON.stringify({ ...JSON.parse(read("pack.json")), format: "nope" });
    await expect(loadAvatarPack("https://x.test/p.json", { fetch: respond({ "/p.json": bad }) as never })).rejects.toMatchObject({
      path: "format",
    });
  });

  it("rejects when the sheet does not load", async () => {
    imageFails = true;
    await expect(
      loadAvatarPack("https://x.test/p.json", { fetch: respond({ "/p.json": read("pack.json") }) as never }),
    ).rejects.toMatchObject({ path: "sheet.src" });
  });
});

describe("loadClassicAvatarPack", () => {
  const files = { "/m/a.json": read("classic-a.json"), "/m/b.json": read("classic-b.json") };

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("loads the pixel format with its own frame size and preloads the sheet", async () => {
    const pack = await loadClassicAvatarPack({
      sheetUrl: "https://x.test/m/sheet.png",
      mapUrl: "https://x.test/m/b.json",
      fetch: respond(files) as never,
    });
    expect(pack.sheetUrl).toBe("https://x.test/m/sheet.png");
    expect(pack.sheet).toMatchObject({ frameWidth: 32, frameHeight: 32 });
    expect(pack.roles.greet).toBe("Wave");
    expect(pack.license).toEqual({ name: "unknown", attribution: "Supplied by the integrator" });
    expect(requested).toEqual(["https://x.test/m/sheet.png"]);
  });

  it("infers the column/row frame size from a stubbed image", async () => {
    imageSize = { w: 128, h: 128 };
    const pack = await loadClassicAvatarPack({
      sheetUrl: "https://x.test/m/sheet.png",
      mapUrl: "https://x.test/m/a.json",
      fetch: respond(files) as never,
    });
    expect(pack.sheet).toMatchObject({ frameWidth: 32, frameHeight: 32, columns: 4 });
    expect(pack.frames["Wave"]?.map((f) => f.x)).toEqual([32, 64, 96]);
  });

  it("uses the caller's frameSize without measuring the sheet", async () => {
    imageSize = { w: 999, h: 999 };
    const pack = await loadClassicAvatarPack({
      sheetUrl: "https://x.test/m/sheet.png",
      mapUrl: "https://x.test/m/a.json",
      frameSize: { w: 16, h: 8 },
      name: "Mine",
      roles: { greet: "GoodBye" },
      fetch: respond(files) as never,
    });
    expect(pack.sheet).toMatchObject({ frameWidth: 16, frameHeight: 8 });
    expect(pack.name).toBe("Mine");
    expect(pack.roles.greet).toBe("GoodBye");
    expect(requested).toEqual(["https://x.test/m/sheet.png"]);
  });

  it("throws on an unknown shape and on a missing role target", async () => {
    const fetchMock = respond({ "/m/p.json": read("pack.json"), ...files });
    await expect(
      loadClassicAvatarPack({ sheetUrl: "https://x.test/s.png", mapUrl: "https://x.test/m/p.json", fetch: fetchMock as never }),
    ).rejects.toBeInstanceOf(AvatarPackError);
    await expect(
      loadClassicAvatarPack({
        sheetUrl: "https://x.test/s.png",
        mapUrl: "https://x.test/m/b.json",
        roles: { greet: "Missing" },
        fetch: fetchMock as never,
      }),
    ).rejects.toMatchObject({ path: "roles.greet" });
  });

  it("reports an unmeasurable or missing sheet", async () => {
    imageFails = true;
    await expect(
      loadClassicAvatarPack({ sheetUrl: "https://x.test/s.png", mapUrl: "https://x.test/m/a.json", fetch: respond(files) as never }),
    ).rejects.toMatchObject({ path: "sheetUrl" });
    await expect(
      loadClassicAvatarPack({ sheetUrl: "https://x.test/s.png", mapUrl: "https://x.test/m/b.json", fetch: respond(files) as never }),
    ).rejects.toMatchObject({ path: "sheet.src" });
  });

  it("reports a map that cannot be fetched", async () => {
    await expect(
      loadClassicAvatarPack({ sheetUrl: "https://x.test/s.png", mapUrl: "https://x.test/none.json", fetch: respond(files) as never }),
    ).rejects.toMatchObject({ path: "mapUrl" });
  });

  it("logs the unknown license once in dev builds", async () => {
    vi.resetModules();
    const fresh = await import("../../src/avatar/loaders");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const source = { sheetUrl: "https://x.test/s.png", mapUrl: "https://x.test/m/b.json", fetch: respond(files) as never };
    await fresh.loadClassicAvatarPack(source);
    await fresh.loadClassicAvatarPack(source);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("unknown");
  });
});

describe("thumbtackPack", () => {
  function captured(): { urls: string[]; fetch: typeof fetch } {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      return new Response(thumbtack);
    });
    return { urls, fetch: fetchMock as never };
  }

  it("loads thumbtack/pack.json under a given base", async () => {
    const spy = captured();
    vi.stubGlobal("fetch", spy.fetch);
    const pack = await thumbtackPack("https://cdn.test/vt/");
    expect(spy.urls).toEqual(["https://cdn.test/vt/thumbtack/pack.json"]);
    expect(pack.name).toBe("Thumbtack");
    expect(pack.sheetUrl).toBe("https://cdn.test/vt/thumbtack/sheet.png");
    vi.unstubAllGlobals();
  });

  it("defaults to the folder of the module that ships the assets", async () => {
    const spy = captured();
    vi.stubGlobal("fetch", spy.fetch);
    await thumbtackPack();
    expect(spy.urls).toHaveLength(1);
    expect(spy.urls[0]).toMatch(/\/src\/avatar\/thumbtack\/pack\.json$/);
    vi.unstubAllGlobals();
  });

  it("rejects instead of throwing for a bad base", async () => {
    await expect(thumbtackPack("http://[bad")).rejects.toMatchObject({ path: "baseUrl" });
  });
});
