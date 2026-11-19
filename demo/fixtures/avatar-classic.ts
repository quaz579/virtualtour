import { createTour } from "../../packages/core/src/index";
import type { StepConfig, Tour } from "../../packages/core/src/index";
import { loadAvatarPack, loadClassicAvatarPack, thumbtackPack, withAvatar } from "../../packages/core/src/avatar/index";
import type { NormalizedPack } from "../../packages/core/src/avatar/pack";
import "../../packages/core/src/styles/avatar.css";

declare const __VT_CORE_DIST__: string;

const fixture = (name: string): string => new URL(`../../packages/core/e2e/fixtures/test-pack/${name}`, import.meta.url).href;
const classicAUrl = fixture("classic-a.json");
const classicBUrl = fixture("classic-b.json");
const packUrl = fixture("pack.json");
const sheetUrl = fixture("sheet.png");

type Kind = "classic-a" | "classic-b" | "v1" | "thumbtack" | "thumbtack-dist" | "thumbtack-bundle";

interface Sample {
  t: number;
  pos: string;
}

declare global {
  interface Window {
    vtClassicTour?: Tour;
    vtClassicPack?: NormalizedPack;
    vtClassicRun: (kind: Kind) => Promise<void>;
    vtClassicSample: (animation: string) => Promise<Sample[]>;
  }
}

function load(kind: Kind): Promise<NormalizedPack> {
  switch (kind) {
    case "classic-a":
      return loadClassicAvatarPack({ sheetUrl, mapUrl: classicAUrl, name: "Classic A" });
    case "classic-b":
      return loadClassicAvatarPack({ sheetUrl, mapUrl: classicBUrl, name: "Classic B" });
    case "v1":
      return loadAvatarPack(packUrl);
    case "thumbtack":
      return thumbtackPack();
    case "thumbtack-dist":
      return thumbtackPack(`${location.origin}/@fs${__VT_CORE_DIST__}/`);
    case "thumbtack-bundle": {
      const bundle = `${location.origin}/@fs${__VT_CORE_DIST__}/avatar.js`;
      return import(/* @vite-ignore */ bundle).then((mod: { thumbtackPack: () => Promise<NormalizedPack> }) => mod.thumbtackPack());
    }
  }
}

function buildTour(pack: NormalizedPack, steps: StepConfig[]): Tour {
  return createTour({ animate: false, dim: false, presenter: withAvatar(pack, { scale: 1, idle: false }), steps });
}

window.vtClassicRun = async (kind) => {
  window.vtClassicTour?.finish();
  const pack = await load(kind);
  window.vtClassicPack = pack;
  const tour = buildTour(pack, [
    { id: "one", title: "First", body: "Hello.", target: "#first", placement: { side: "bottom" } },
    { id: "two", title: "Second", body: "Bye.", target: "#second", placement: { side: "bottom" } },
  ]);
  window.vtClassicTour = tour;
  await tour.start();
};

window.vtClassicSample = async (animation) => {
  window.vtClassicTour?.finish();
  const pack = window.vtClassicPack;
  if (!pack) throw new Error("no pack");
  const frames = pack.frames[animation];
  if (!frames) throw new Error(`no animation ${animation}`);
  const duration = frames.reduce((total, frame) => total + frame.ms, 0);
  const samples: Sample[] = [];
  const startedAt = performance.now();
  let sampling = true;
  const record = (): void => {
    const el = document.querySelector<HTMLElement>(".vt-avatar");
    if (el) samples.push({ t: performance.now() - startedAt, pos: el.style.backgroundPosition });
  };
  const loop = (): void => {
    if (!sampling) return;
    record();
    requestAnimationFrame(loop);
  };
  const observer = new MutationObserver(record);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  requestAnimationFrame(loop);
  const tour = buildTour(pack, [{ id: "sample", title: "Sample", body: "Watch.", extensions: { avatar: { animation } } }]);
  window.vtClassicTour = tour;
  await tour.start();
  await new Promise((resolve) => setTimeout(resolve, duration + 400));
  const el = document.querySelector<HTMLElement>(".vt-avatar");
  if (el) samples.push({ t: performance.now() - startedAt, pos: el.style.backgroundPosition });
  sampling = false;
  observer.disconnect();
  return samples;
};

document.documentElement.dataset["ready"] = "true";
