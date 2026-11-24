import { createTour, tours } from "virtual-site-tour";

export const tour = createTour({
  id: "events",
  steps: [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
  ],
});

export function listen(track: (name: string, detail?: string) => void): () => void {
  const stops = [
    tour.on("started", () => track("tour_started")),
    tour.on("step-shown", ({ step, previous }) => track("step_shown", `${previous?.id ?? "-"} -> ${step.id}`)),
    tour.on("finished", () => track("tour_finished")),
    tour.on("exited", ({ reason }) => track("tour_exited", reason)),
    tour.on("bypassed", ({ reason }) => track("tour_bypassed", reason)),
    tours.on("deactivated", ({ tour: ended }) => track("tour_deactivated", ended.id)),
  ];
  tour.steps[0]?.on("will-show", ({ step }) => track("will_show", step.id));
  return () => stops.forEach((stop) => stop());
}
