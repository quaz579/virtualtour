import { createTour } from "virtualtour";

export const lockPage = createTour({
  id: "lock-page",
  dim: { pageScroll: false },
  steps: [{ id: "a", target: "#a", title: "The page cannot scroll" }],
});

export const lockList = createTour({
  id: "lock-list",
  dim: { lockScrollParent: true },
  steps: [{ id: "row", target: "#row-3", title: "The list holds still" }],
});

export const unclipped = createTour({
  id: "unclipped",
  dim: { clipToScrollParents: false },
  steps: [{ id: "row", target: "#row-3", title: "Cut-out covers the whole row" }],
});
