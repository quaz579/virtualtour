import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";
import { glide, progressVars } from "../../packages/core/src/motion";

declare global {
  interface Window {
    vtTour: Tour;
    vtOff: { glide: () => void; progress: () => void };
  }
}

function main(): void {
  const params = new URLSearchParams(location.search);
  const tour = createTour({
    id: "motion-demo",
    animate: params.get("animate") !== "0",
    counter: (index, total) => `Step ${index} of ${total}`,
    steps: [
      { id: "one", title: "One", body: "First.", target: "#m1", placement: { side: "right" } },
      { id: "two", title: "Two", body: "Second.", target: "#m2", placement: { side: "left" } },
      { id: "three", title: "Three", body: "Third.", target: "#m3", placement: { side: "top" } },
    ],
  });
  window.vtTour = tour;
  window.vtOff = {
    glide: params.has("noglide") ? () => {} : glide(tour, { durationMs: Number(params.get("duration") ?? 400) }),
    progress: progressVars(tour),
  };
  tour.on("step-shown", ({ step }) => {
    step.element?.setAttribute("data-vt-progress-bar", "");
    const { index, total } = tour.progressInfo();
    document.querySelector("#counter")!.textContent = `${index}/${total}`;
  });
  document.documentElement.dataset["ready"] = "true";
}

main();
