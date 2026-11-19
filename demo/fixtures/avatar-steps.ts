import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { withAvatar } from "../../packages/core/src/avatar/index";
import type { AvatarOptions } from "../../packages/core/src/avatar/index";
import testPack from "../../packages/core/e2e/fixtures/test-pack/pack.json";
import "../../packages/core/src/styles/avatar.css";

declare global {
  interface Window {
    vtStepsTour?: Tour;
    vtStepsRun: (options?: AvatarOptions & { broken?: boolean }) => Promise<void>;
    vtStepsErrors: string[];
  }
}

const pack = () => {
  const copy = JSON.parse(JSON.stringify(testPack)) as typeof testPack;
  copy.sheet.src = new URL("../../packages/core/e2e/fixtures/test-pack/sheet.png", import.meta.url).href;
  return copy;
};

window.vtStepsErrors = [];

window.vtStepsRun = async ({ broken, ...options } = {}) => {
  window.vtStepsTour?.finish();
  window.vtStepsErrors = [];
  const source = broken ? Promise.reject(new Error("pack failed")) : (pack() as never);
  const tour = createTour({
    animate: false,
    dim: false,
    presenter: withAvatar(source, { ...options, onError: (error) => window.vtStepsErrors.push(error.message) }),
    steps: [
      { id: "welcome", title: "Welcome", body: "No target here." },
      { id: "right", title: "Right", body: "Look right.", target: "#right", placement: { side: "bottom" }, extensions: { avatar: { dock: "start" } } },
      { id: "think", title: "Think", body: "Hmm.", target: "#below", placement: { side: "top" }, extensions: { avatar: { animation: "think" } } },
      { id: "action", title: "Action", body: "Do it.", target: "#action", placement: { side: "bottom" }, instruction: "Click the button.", advanceDelay: 3000, autoAdvance: { event: "click" } },
    ],
  });
  window.vtStepsTour = tour;
  await tour.start();
};

document.documentElement.dataset["ready"] = "true";
