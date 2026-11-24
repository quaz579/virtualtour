import { createTour } from "virtual-site-tour";

export const tour = createTour({
  id: "dim",
  dim: {
    color: "#0b1020",
    opacity: 0.6,
    padding: 8,
    radius: { topLeft: 12, bottomRight: 12 },
    transitionMs: 250,
    clickOutside: "none",
  },
  steps: [
    { id: "a", target: "#a", title: "Rounded on two corners" },
    { id: "b", target: "#b", title: "Tighter and square", spotlight: { padding: 2, radius: 0 } },
  ],
});

export const noOverlay = createTour({
  id: "no-dim",
  dim: false,
  steps: [{ id: "a", target: "#a", title: "Popover only" }],
});

export const defaultOverlay = createTour({
  id: "default-dim",
  dim: true,
  steps: [{ id: "a", target: "#a", title: "Default overlay" }],
});
