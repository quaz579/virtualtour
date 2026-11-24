import { createTour } from "virtual-site-tour";

export const tour = createTour({
  steps: [
    { target: "#save", title: "Save", autoAdvance: { event: "click", selector: "#save" } },
    { target: "#name", title: "Name it", autoAdvance: { event: "input" } },
    { title: "All set" },
  ],
});
