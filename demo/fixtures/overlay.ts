import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vt: { createTour: typeof createTour };
    vtTour: Tour;
    vtLog: string[];
  }
}

window.vt = { createTour };
window.vtLog = [];

document.querySelectorAll<HTMLElement>("[data-count]").forEach((element) => {
  element.addEventListener("click", () => {
    element.dataset["count"] = String(Number(element.dataset["count"]) + 1);
  });
});

document.documentElement.dataset.ready = "true";
