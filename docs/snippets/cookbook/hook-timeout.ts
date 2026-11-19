import { createTour } from "virtualtour";

export const tour = createTour({
  steps: [
    {
      id: "slow",
      title: "Loaded data",
      target: "#chart",
      hookTimeout: 3000,
      prepare: () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    },
  ],
});
