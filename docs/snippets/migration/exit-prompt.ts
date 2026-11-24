import { createTour } from "virtual-site-tour";

export const tour = createTour({
  exitPrompt: async () => window.confirm("Leave the tour?"),
  steps: [{ title: "Welcome" }, { title: "Next stop" }],
});

export async function leave() {
  const left = await tour.exit();
  return left;
}
