import { createTour } from "virtual-site-tour";

export async function drive() {
  const tour = createTour({ steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] });
  await tour.start();
  console.log(tour.isRunning(), tour.progressInfo(), tour.currentStep?.id);
  tour.appendStep({ id: "c", title: "C" }, "b");
  tour.nudge("Not yet");
  await tour.goTo("c");
  await tour.backward();
  await tour.forward();
  tour.refresh();
  tour.hideCurrent();
  await tour.goTo();
  tour.dropStep("c");
  const accepted = await tour.exit();
  return accepted;
}
