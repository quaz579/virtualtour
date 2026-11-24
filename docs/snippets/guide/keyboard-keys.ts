import { createTour } from "virtual-site-tour";

export const noEscape = createTour({
  id: "no-escape",
  keys: { escape: false },
  steps: [{ id: "a", title: "Close with the button only" }],
});

export const noArrows = createTour({
  id: "no-arrows",
  keys: { arrows: false },
  exitPrompt: "Leave the tour?",
  steps: [{ id: "a", title: "Escape asks first" }, { id: "b", title: "B" }],
});
