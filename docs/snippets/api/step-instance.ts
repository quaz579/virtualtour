import { createTour } from "virtualtour";

export async function inspectSteps() {
  const tour = createTour({ steps: [{ id: "a", title: "A", target: "#a" }, { id: "b", title: "B" }] });
  const step = tour.stepById("a");
  if (!step) return;
  step.configure({ title: "A, renamed" });
  const stop = step.on("shown", ({ step: shown }) => console.log(shown.id, shown.resolvedTarget));
  await step.show();
  console.log(step.isShown(), step.element, step.config.title);
  step.hide();
  stop();
}
