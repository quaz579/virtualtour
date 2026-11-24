import { createTour } from "virtual-site-tour";

export const tour = createTour({
  id: "defaults",
  stepDefaults: {
    position: { offset: 14 },
    whenMissing: "skip",
    closeButton: false,
  },
  steps: [
    { id: "one", target: "#one", title: "One" },
    { id: "two", target: "#two", title: "Two", position: { flip: false } },
    { title: "Generated id", target: "#three" },
  ],
});

export const generatedId = tour.steps[2]?.id;
