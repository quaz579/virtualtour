import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { loadAvatarPack, withAvatar } from "../../packages/core/src/avatar/index";
import testPack from "../../packages/core/e2e/fixtures/test-pack/pack.json";
import "../../packages/core/src/styles/avatar.css";

type Mode = "ok" | "pack-404" | "sheet-404" | "delayed";

interface RunOptions {
  mode: Mode;
  delayMs?: number;
  loadTimeoutMs?: number;
}

declare global {
  interface Window {
    vtFallbackTour?: Tour;
    vtFallbackErrors: string[];
    vtFallbackRun: (options: RunOptions) => Promise<void>;
  }
}

const fixture = (name: string): string => new URL(`../../packages/core/e2e/fixtures/test-pack/${name}`, import.meta.url).href;

function pack(sheet: string): typeof testPack {
  const copy = JSON.parse(JSON.stringify(testPack)) as typeof testPack;
  copy.sheet.src = sheet;
  return copy;
}

function source({ mode, delayMs = 0 }: RunOptions): Promise<never> | never {
  switch (mode) {
    case "pack-404":
      return loadAvatarPack(fixture("missing/pack.json")) as never;
    case "sheet-404":
      return pack(fixture("missing/sheet.png")) as never;
    case "delayed":
      return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => pack(fixture("sheet.png"))) as never;
    case "ok":
      return pack(fixture("sheet.png")) as never;
  }
}

window.vtFallbackErrors = [];

window.vtFallbackRun = async (options) => {
  window.vtFallbackTour?.finish();
  window.vtFallbackErrors = [];
  const tour = createTour({
    animate: false,
    dim: false,
    presenter: withAvatar(source(options), {
      ...(options.loadTimeoutMs === undefined ? {} : { loadTimeoutMs: options.loadTimeoutMs }),
      onError: (error) => window.vtFallbackErrors.push(error.message),
    }),
    steps: [
      { id: "one", title: "First", body: "Hello.", target: "#first", placement: { side: "bottom" } },
      { id: "two", title: "Second", body: "Next.", target: "#second", placement: { side: "bottom" } },
      { id: "three", title: "Third", body: "Centered." },
      { id: "four", title: "Fourth", body: "Done." },
    ],
  });
  window.vtFallbackTour = tour;
  await tour.start();
};

document.documentElement.dataset["ready"] = "true";
