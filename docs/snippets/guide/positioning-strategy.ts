import { createTour } from "virtualtour";

export const tour = createTour({
  id: "strategy",
  stepDefaults: { position: { strategy: "absolute" } },
  steps: [
    { id: "in-transformed-pane", target: "#pane-button", title: "Positioned inside the pane", placement: { side: "bottom" } },
    { id: "centered", title: "Centered steps ignore the strategy" },
  ],
});
