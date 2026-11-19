import { createTour } from "virtualtour";
import { progressVars } from "virtualtour/motion";

export function withProgressBar() {
  const tour = createTour({ steps: [{ title: "One" }, { title: "Two" }, { title: "Three" }] });
  const off = progressVars(tour);
  tour.on("step-shown", ({ step }) => step.element?.setAttribute("data-vt-progress-bar", ""));
  tour.on("deactivated", off);
  return tour;
}
