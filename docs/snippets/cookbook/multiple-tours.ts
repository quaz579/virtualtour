import { createTour, tours } from "virtualtour";

export const welcome = createTour({
  id: "welcome",
  namespace: "welcome",
  steps: [{ title: "Welcome" }],
});

export const billing = createTour({
  id: "billing",
  namespace: "billing",
  steps: [{ title: "Billing" }],
});

export function runBoth() {
  const stop = tours.on("exited", ({ tour, reason }) => {
    console.log(tour.id, reason);
  });
  void welcome.start();
  void billing.start();
  return stop;
}
