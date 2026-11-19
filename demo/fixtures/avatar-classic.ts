import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { loadAvatarPack, loadClassicAvatarPack, SpeakerPresenter, thumbtackPack } from "../../packages/core/src/avatar/index";
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
    vtClassicPresenter?: SpeakerPresenter;
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

window.vtClassicRun = async (kind) => {
  window.vtClassicTour?.finish();
  const pack = await load(kind);
  window.vtClassicPack = pack;
  const tour = createTour({
    animate: false,
    dim: false,
    presenter: (t) => {
      window.vtClassicPresenter = new SpeakerPresenter(t, pack, { scale: 1 });
      return window.vtClassicPresenter;
    },
    steps: [
      { id: "one", title: "First", body: "Hello.", target: "#first", placement: { side: "bottom" } },
      { id: "two", title: "Second", body: "Bye.", target: "#second", placement: { side: "bottom" } },
    ],
  });
  window.vtClassicTour = tour;
  await tour.start();
};

window.vtClassicSample = async (animation) => {
  const presenter = window.vtClassicPresenter;
  const el = presenter?.avatar;
  if (!presenter || !el) throw new Error("no presenter");
  const samples: Sample[] = [];
  const startedAt = performance.now();
  const positionOf = (style: string | null): string => /background-position:\s*([^;]+)/.exec(style ?? "")?.[1]?.trim() ?? "";
  const push = (pos: string): void => {
    samples.push({ t: performance.now() - startedAt, pos });
  };
  let started = false;
  let skipOld = false;
  const take = (records: MutationRecord[]): void => {
    for (const rec of records) {
      if (rec.attributeName === "data-vt-anim") {
        if (!started && el.getAttribute("data-vt-anim") === animation) {
          started = true;
          skipOld = true;
        }
      } else if (started) {
        if (skipOld) skipOld = false;
        else push(positionOf(rec.oldValue));
      }
    }
  };
  const observer = new MutationObserver(take);
  observer.observe(el, { attributes: true, attributeOldValue: true, attributeFilter: ["style", "data-vt-anim"] });
  await presenter.player.play(animation);
  take(observer.takeRecords());
  observer.disconnect();
  push(el.style.backgroundPosition);
  return samples;
};

document.documentElement.dataset["ready"] = "true";
