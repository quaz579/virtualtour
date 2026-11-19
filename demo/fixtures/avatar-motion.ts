import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { withAvatar } from "../../packages/core/src/avatar/index";
import type { AvatarOptions } from "../../packages/core/src/avatar/index";
import testPack from "../../packages/core/e2e/fixtures/test-pack/pack.json";
import "../../packages/core/src/styles/avatar.css";

interface RunOptions extends AvatarOptions {
  animate?: boolean;
  dim?: boolean;
}

declare global {
  interface Window {
    vtMotionTour?: Tour;
    vtMotionRun: (options?: RunOptions) => Promise<void>;
    vtMotionAnims: string[];
  }
}

const pack = () => {
  const copy = JSON.parse(JSON.stringify(testPack)) as typeof testPack;
  copy.sheet.src = new URL("../../packages/core/e2e/fixtures/test-pack/sheet.png", import.meta.url).href;
  return copy;
};

window.vtMotionAnims = [];

window.vtMotionRun = async ({ animate = false, dim = false, ...options } = {}) => {
  window.vtMotionTour?.finish();
  window.vtMotionAnims = [];
  const tour = createTour({
    animate,
    dim: dim ? { transitionMs: 600, padding: 0, radius: 0 } : false,
    presenter: withAvatar(pack() as never, options),
    steps: [
      { id: "one", title: "One", body: "First.", target: "#one", placement: { side: "bottom" }, extensions: { avatar: { animation: "rest" } } },
      { id: "two", title: "Two", body: "Second.", target: "#two", placement: { side: "bottom" }, extensions: { avatar: { animation: "rest" } } },
    ],
  });
  window.vtMotionTour = tour;
  await tour.start();
  const avatar = document.querySelector<HTMLElement>(".vt-avatar");
  if (!avatar) return;
  const record = (): void => {
    const name = avatar.getAttribute("data-vt-anim");
    if (name) window.vtMotionAnims.push(name);
  };
  record();
  new MutationObserver(record).observe(avatar, {
    attributes: true,
    attributeFilter: ["data-vt-anim"],
  });
};

document.documentElement.dataset["ready"] = "true";
