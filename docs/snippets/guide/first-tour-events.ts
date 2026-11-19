import { tour } from "./first-tour";

tour.on("step-shown", ({ step }) => {
  console.log("showing", step.id);
});

tour.on("finished", () => {
  console.log("the user reached Done");
});

tour.on("exited", ({ reason }) => {
  console.log("the user left early:", reason);
});
