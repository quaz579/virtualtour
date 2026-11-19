import { createTour } from "virtualtour";

export const tour = createTour({
  dim: { clickOutside: "exit", lockScrollParent: true },
  steps: [
    {
      target: "#save",
      placement: { side: "bottom", align: "start" },
      position: { flip: false },
      title: "Save",
      body: "Press Save to keep your work.",
    },
  ],
});
