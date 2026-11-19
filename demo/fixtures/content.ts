import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
    vtLog: string[];
  }
}

const note = document.createElement("div");
note.id = "content-note";
note.textContent = "Custom element body";

const tour = createTour({
  name: "content",
  dim: true,
  animate: false,
  steps: [
    {
      id: "titled",
      title: "Titled step",
      body: note,
      closeButton: { label: "Dismiss tour", attrs: { "data-track": "close" } },
    },
    { id: "untitled", label: "Untitled step label", body: ["First paragraph", "Second paragraph"] },
  ],
});

window.vtTour = tour;
window.vtLog = [];
tour.on("step-shown", (p) => window.vtLog.push(`shown:${p.step.id}`));
tour.on("deactivated", () => window.vtLog.push("deactivated"));

document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
  void tour.start();
});

document.documentElement.dataset.ready = "true";
