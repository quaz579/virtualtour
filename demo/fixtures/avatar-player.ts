import { SpritePlayer } from "../../packages/core/src/avatar/index";
import { normalizePack, validatePack } from "../../packages/core/src/avatar/pack";
import type { NormalizedPack } from "../../packages/core/src/avatar/pack";
import testPack from "../../packages/core/e2e/fixtures/test-pack/pack.json";

declare global {
  interface Window {
    vtPack: NormalizedPack;
    vtEl: HTMLElement;
    vtPlayer: SpritePlayer;
    vtMakePlayer: (sheet: string) => { el: HTMLElement; player: SpritePlayer };
    vtSample: (run: () => Promise<void>) => Promise<{ samples: { t: number; pos: string }[]; resolvedAt: number; startedAt: number }>;
  }
}

const json = JSON.parse(JSON.stringify(testPack)) as typeof testPack & { animations: Record<string, unknown> };
json.animations["march"] = {
  frames: [0, 1, 2, 3].map((col) => ({ col, row: 1, ms: 120 })),
  still: 3,
};
json.sheet.src = new URL("../../packages/core/e2e/fixtures/test-pack/sheet.png", import.meta.url).href;

const pack = normalizePack(validatePack(json), location.href);
const host = document.getElementById("host") as HTMLElement;

function makePlayer(sheet: string): { el: HTMLElement; player: SpritePlayer } {
  const el = document.createElement("div");
  host.appendChild(el);
  return { el, player: new SpritePlayer({ ...pack, sheetUrl: sheet }, el) };
}

const main = makePlayer(pack.sheetUrl);
window.vtPack = pack;
window.vtEl = main.el;
window.vtPlayer = main.player;
window.vtMakePlayer = makePlayer;
window.vtSample = async (run) => {
  const samples: { t: number; pos: string }[] = [];
  let sampling = true;
  const startedAt = performance.now();
  const loop = (): void => {
    if (!sampling) return;
    samples.push({ t: performance.now() - startedAt, pos: main.el.style.backgroundPosition });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  await run();
  const resolvedAt = performance.now() - startedAt;
  samples.push({ t: resolvedAt, pos: main.el.style.backgroundPosition });
  sampling = false;
  return { samples, resolvedAt, startedAt };
};
document.documentElement.setAttribute("data-ready", "true");
