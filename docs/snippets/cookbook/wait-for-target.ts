import { createTour } from "virtualtour";

export const tour = createTour({
  steps: [{ id: "panel", title: "The panel", target: "#panel-button", waitFor: 3000, whenMissing: "skip" }],
});
