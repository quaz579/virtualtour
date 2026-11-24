import { createTour } from "virtual-site-tour";

export const tour = createTour({
  counter: (index, total) => `Step ${index} of ${total}`,
  steps: [{ title: "Welcome" }, { title: "Next stop" }, { title: "Done" }],
});
