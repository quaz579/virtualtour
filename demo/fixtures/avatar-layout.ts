import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { SpeakerPresenter } from "../../packages/core/src/avatar/index";
import { normalizePack, validatePack } from "../../packages/core/src/avatar/pack";
import testPack from "../../packages/core/e2e/fixtures/test-pack/pack.json";
import "../../packages/core/src/styles/avatar.css";

interface RunOptions {
  target?: string;
  side?: "top" | "bottom" | "left" | "right" | "over" | "auto";
  align?: "start" | "center" | "end";
  dock?: "start" | "end" | "auto";
  scale?: number;
  frame?: [number, number];
  dim?: boolean;
  hidden?: boolean;
  namespace?: string;
}

declare global {
  interface Window {
    vtTour?: Tour;
    vtPresenter?: SpeakerPresenter;
    vtRun: (options?: RunOptions) => Promise<void>;
  }
}

const json = JSON.parse(JSON.stringify(testPack)) as typeof testPack;
json.sheet.src = new URL("../../packages/core/e2e/fixtures/test-pack/sheet.png", import.meta.url).href;
const packFor = (frame?: [number, number]) => {
  const copy = JSON.parse(JSON.stringify(json)) as typeof testPack;
  copy.sheet.src = json.sheet.src;
  if (frame) {
    copy.sheet.frameWidth = frame[0];
    copy.sheet.frameHeight = frame[1];
  }
  return normalizePack(validatePack(copy), location.href);
};

window.vtRun = async (options = {}) => {
  window.vtTour?.finish();
  const step = {
    id: "speak",
    title: "Speaker title",
    body: "A line of text long enough to wrap onto a few lines, so the bubble has real height to work with.",
    target: options.target ?? "#center",
    placement: { side: options.side ?? "bottom", align: options.align ?? "center" },
    extensions: { avatar: { ...(options.dock ? { dock: options.dock } : {}), ...(options.hidden ? { hidden: true } : {}) } },
  };
  const tour = createTour({
    steps: [step],
    animate: false,
    dim: options.dim ?? false,
    ...(options.namespace ? { namespace: options.namespace } : {}),
    presenter: (t) => {
      window.vtPresenter = new SpeakerPresenter(t, packFor(options.frame), { scale: options.scale ?? 3, ...(options.namespace ? { namespace: options.namespace } : {}) });
      return window.vtPresenter;
    },
  });
  window.vtTour = tour;
  await tour.start();
};

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (params.has("theme")) await import("../../packages/core/src/styles/theme.css");
  if (params.has("rtl")) document.documentElement.setAttribute("dir", "rtl");
  if (params.has("modal")) (document.getElementById("modal") as HTMLDialogElement).showModal();
  document.documentElement.dataset["ready"] = "true";
}

void main();
