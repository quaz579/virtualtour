import { createTour, tours } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
  }
}

const tour = createTour({
  name: "auto-advance",
  animate: false,
  dim: false,
  steps: [
    { id: "save", title: "Save", body: "Click Save.", target: "#save", autoAdvance: { event: "click", selector: "#save" } },
    { id: "name", title: "Name", body: "Type a name.", target: "#name", autoAdvance: { event: "input" } },
    { id: "page", title: "Page", body: "The page moves the tour." },
    { id: "end", title: "End", body: "Done." },
  ],
});

window.vtTour = tour;
window.vtLog = [];
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("finished", () => window.vtLog.push("finished"));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});
document.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", () => window.vtLog.push("save-clicked"));
document.querySelector<HTMLButtonElement>("#page-forward")?.addEventListener("click", () => {
  void tours.current?.forward();
});

document.documentElement.dataset.ready = "true";
