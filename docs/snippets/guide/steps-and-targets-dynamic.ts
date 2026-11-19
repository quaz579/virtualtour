import { createTour } from "virtualtour";

export const tour = createTour({
  id: "dynamic",
  steps: [
    { id: "intro", title: "Intro" },
    { id: "last", title: "Last" },
  ],
});

export async function run(): Promise<void> {
  await tour.start();
  tour.appendStep({ id: "extra", title: "Extra" }, "last");
  tour.stepById("extra")?.configure({ title: "Extra, renamed" });
  await tour.goTo("extra");
  tour.dropStep("intro");
}
