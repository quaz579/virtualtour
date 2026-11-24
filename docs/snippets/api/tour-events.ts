import { createTour, tours } from "virtual-site-tour";

export function listen() {
  const tour = createTour({ steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
  const stops = [
    tour.on("started", ({ tour: t }) => console.log("started", t.id)),
    tour.on("step-shown", ({ step, previous }) => console.log(step.id, previous?.id ?? null)),
    tour.on("step-completed", ({ step }) => console.log("completed", step.id)),
    tour.on("finished", () => console.log("finished")),
    tour.on("exited", ({ reason }) => console.log("exited", reason)),
    tour.on("bypassed", ({ reason }) => console.log("bypassed", reason)),
    tour.once("deactivated", () => console.log("done with this run")),
    tours.on("activated", ({ tour: t }) => console.log("any tour:", t.id)),
  ];
  return () => stops.forEach((stop) => stop());
}
