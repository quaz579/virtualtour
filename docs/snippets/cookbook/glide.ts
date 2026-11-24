import { createTour } from "virtual-site-tour";
import { glide } from "virtual-site-tour/motion";

export function withGlide() {
  const tour = createTour({ steps: [{ target: "#a", title: "A" }, { target: "#b", title: "B" }] });
  const off = glide(tour, { durationMs: 300 });
  tour.on("deactivated", off);
  return tour;
}
