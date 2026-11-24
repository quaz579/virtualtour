import { createTour } from "virtual-site-tour";

export const tour = createTour({
  dim: { pageScroll: false, lockScrollParent: true },
  steps: [{ target: "#row-12", title: "A row in a long list" }],
});
