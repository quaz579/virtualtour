import { createTour } from "virtual-site-tour";
import { progressVars } from "virtual-site-tour/motion";

export function tourWithProgressBar() {
  const tour = createTour({
    steps: [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
      { id: "three", title: "Three" },
    ],
  });
  const stopVars = progressVars(tour);
  tour.on("step-shown", ({ step }) => step.element?.setAttribute("data-vt-progress-bar", ""));
  tour.on("deactivated", stopVars);
  return tour;
}
