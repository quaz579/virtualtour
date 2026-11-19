import { createTour } from "virtualtour";

export const tour = createTour({
  id: "timeouts",
  waitBudget: 6000,
  steps: [
    { id: "a", title: "A" },
    {
      id: "b",
      target: "#slow-widget",
      title: "B",
      waitFor: 4000,
      prepare: () => fetch("/api/ready").then(() => undefined),
      hookTimeout: 2000,
    },
    {
      id: "c",
      target: "#slow-chart",
      title: "C",
      waitFor: 4000,
      whenMissing: "skip",
      hookTimeout: 0,
    },
  ],
});
