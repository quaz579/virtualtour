import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
  }
}

const trailing = new URLSearchParams(location.search).get("trailing") === "1";

const tour = createTour({
  name: "skip",
  animate: false,
  steps: [
    { id: "one", title: "One", body: "First.", target: "#first" },
    { id: "ghost", title: "Ghost", body: "Never shown.", target: "#ghost", whenMissing: "skip" },
    ...(trailing
      ? []
      : [{ id: "three", title: "Three", body: "Third.", target: "#last" }]),
  ],
});

window.vtTour = tour;
window.vtLog = [];
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("finished", () => window.vtLog.push("finished"));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
