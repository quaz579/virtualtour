import { createTour } from "virtualtour";
import { glide } from "virtualtour/motion";

export function tourWithGlide() {
  const tour = createTour({
    steps: [
      { id: "one", target: "#one", title: "One" },
      { id: "two", target: "#two", title: "Two" },
    ],
  });
  const stopGlide = glide(tour, { durationMs: 300, easing: "ease-out" });
  tour.on("deactivated", stopGlide);
  return tour;
}
