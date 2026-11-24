import { createTour } from "virtual-site-tour";

export const tour = createTour({
  steps: [
    {
      id: "save",
      target: "#save",
      title: "Save your work",
      instruction: "Click <b>Save</b>.",
      advanceDelay: 600,
      autoAdvance: { event: "click", strict: true },
    },
    { id: "done", title: "Saved" },
  ],
});

tour.on("step-completed", ({ step }) => console.log(`${step.id} done`));
