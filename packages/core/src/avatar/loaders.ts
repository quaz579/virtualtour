import {
  CLASSIC_LICENSE,
  classicGridSize,
  detectClassicFormat,
  fromClassicColumnRowMap,
  fromClassicPositionMap,
} from "./classic";
import type { ClassicSource } from "./classic";
import { AvatarPackError, normalizePack, preloadSheet, validatePack } from "./pack";
import type { NormalizedPack } from "./pack";

declare const __DEV__: boolean | undefined;

/** Options for {@link loadAvatarPack}. */
export interface LoadAvatarPackOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

let warnedClassicLicense = false;

function absolute(url: string, path: string): string {
  try {
    const base = typeof document !== "undefined" ? document.baseURI : undefined;
    return new URL(url, base).href;
  } catch {
    return fail(path, `cannot be resolved as a URL ("${url}")`);
  }
}

function fail(path: string, message: string): never {
  throw new AvatarPackError(path, message);
}

async function fetchJson(url: string, path: string, options: LoadAvatarPackOptions): Promise<unknown> {
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, options.signal ? { signal: options.signal } : undefined);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return fail(path, `could not be fetched (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!response.ok) return fail(path, `could not be fetched (HTTP ${response.status}) from ${url}`);
  try {
    return await response.json();
  } catch {
    return fail(path, `is not valid JSON (${url})`);
  }
}

function measureSheet(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new AvatarPackError("sheetUrl", `could not load ${url}`));
    image.src = url;
  });
}

/**
 * Fetches a `virtualtour-avatar/1` pack, validates it, resolves `sheet.src` against the pack URL and preloads the
 * sheet. Relative URLs resolve against the page.
 * @throws {AvatarPackError} when the fetch fails, the JSON is invalid or the sheet does not load.
 */
export async function loadAvatarPack(url: string, options: LoadAvatarPackOptions = {}): Promise<NormalizedPack> {
  const packUrl = absolute(url, "url");
  const json = await fetchJson(packUrl, "url", options);
  const pack = normalizePack(validatePack(json), packUrl);
  await preloadSheet(pack.sheetUrl);
  return pack;
}

/**
 * Loads a classic character map and sheet, converts either map format (detected by shape) with the default role
 * mapping, and preloads the sheet. The column/row format needs `frameSize`, or the sheet is measured and divided by
 * the largest column and row. Sound and branching fields are ignored. The pack's license is `unknown`.
 * @throws {AvatarPackError} when a file cannot be fetched or loaded, or the map is not a classic format.
 */
export async function loadClassicAvatarPack(source: ClassicSource): Promise<NormalizedPack> {
  const sheetUrl = absolute(source.sheetUrl, "sheetUrl");
  const mapUrl = absolute(source.mapUrl, "mapUrl");
  const json = await fetchJson(mapUrl, "mapUrl", source);
  const convert = {
    sheetUrl,
    ...(source.name !== undefined ? { name: source.name } : {}),
    ...(source.roles !== undefined ? { roles: source.roles } : {}),
  };
  let converted;
  if (detectClassicFormat(json) === "position") {
    converted = fromClassicPositionMap(json, { ...convert, ...(source.frameSize ? { frameSize: source.frameSize } : {}) });
  } else {
    let frameSize = source.frameSize;
    if (!frameSize) {
      const grid = classicGridSize(json);
      const sheet = await measureSheet(sheetUrl);
      frameSize = { w: sheet.width / grid.columns, h: sheet.height / grid.rows };
      if (!(frameSize.w > 0) || !(frameSize.h > 0)) fail("frameSize", "cannot be derived from a sheet with no size");
    }
    converted = fromClassicColumnRowMap(json, { ...convert, frameSize });
  }
  const pack = normalizePack(validatePack(converted), sheetUrl);
  await preloadSheet(pack.sheetUrl);
  if (!warnedClassicLicense && (typeof __DEV__ === "undefined" || __DEV__)) {
    warnedClassicLicense = true;
    console.warn(
      `[virtualtour] Avatar pack "${pack.name}" was converted from a classic map; its license is "${CLASSIC_LICENSE.name}". Make sure you have the right to use this art.`,
    );
  }
  return pack;
}

/**
 * Loads the Thumbtack pack that ships with the package. `baseUrl` is the directory that holds the `thumbtack/`
 * folder (a missing trailing slash is added); it defaults to the folder of this module so bundlers that copy the package assets
 * keep working. Pass a CDN or self-hosted base to serve the files elsewhere.
 */
export async function thumbtackPack(baseUrl?: string): Promise<NormalizedPack> {
  const folder = baseUrl === undefined || baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const base = folder === undefined ? import.meta.url : absolute(folder, "baseUrl");
  return loadAvatarPack(new URL("thumbtack/pack.json", base).href);
}
