import { createTour } from "virtualtour";

export const exitOnClick = createTour({
  id: "click-exit",
  dim: { clickOutside: "exit" },
  exitPrompt: "Leave the tour?",
  steps: [{ id: "a", target: "#a", title: "Click outside to leave" }],
});

export const forwardOnClick = createTour({
  id: "click-forward",
  dim: { clickOutside: "forward" },
  steps: [
    { id: "a", target: "#a", title: "Click outside for the next step" },
    { id: "b", target: "#b", title: "Second" },
  ],
});
