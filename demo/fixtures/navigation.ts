import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
  }
}

const params = new URLSearchParams(location.search);
const exitPrompt = params.get("prompt") ?? undefined;

const tour = createTour({
  name: "navigation",
  dim: true,
  animate: false,
  ...(exitPrompt === undefined ? {} : { exitPrompt }),
  steps: [
    { id: "one", title: "One", body: "First step." },
    { id: "two", title: "Two", body: "Second step." },
    { id: "three", title: "Three", body: "Third step." },
  ],
});

window.vtTour = tour;
window.vtLog = [];
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("finished", () => window.vtLog.push("finished"));
tour.on("exited", (p) => window.vtLog.push(`exited:${p.reason}`));
tour.on("deactivated", () => window.vtLog.push("deactivated"));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
