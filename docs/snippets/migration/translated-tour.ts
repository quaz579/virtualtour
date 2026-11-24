import "virtual-site-tour/base.css";
import { createTour } from "virtual-site-tour";

export const tour = createTour({
  dim: true,
  counter: true,
  keys: { escape: true, arrows: true },
  steps: [
    {
      target: "#save",
      placement: { side: "bottom", align: "start" },
      title: "Save",
      body: "Press Save to keep your work.",
    },
    {
      target: "#share",
      placement: { side: "left" },
      title: "Share",
      body: "Invite a teammate.",
    },
  ],
});

tour.on("step-shown", ({ step }) => {
  console.log("highlighted", step.id);
});

tour.on("finished", () => {
  console.log("done");
});

tour.on("exited", ({ reason }) => {
  console.log("closed", reason);
});

export function startTour() {
  return tour.start();
}

export function nextStep() {
  return tour.forward();
}
