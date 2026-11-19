import { createTour } from "virtualtour";

export const tour = createTour({
  id: "arrow",
  steps: [
    { id: "none", target: "#a", title: "No arrow", placement: { side: "bottom" }, position: { arrow: false } },
    {
      id: "inset",
      target: "#b",
      title: "Arrow stays 28 px from the corners",
      placement: { side: "bottom", align: "start" },
      position: { arrow: { minInset: 28 } },
    },
  ],
});
