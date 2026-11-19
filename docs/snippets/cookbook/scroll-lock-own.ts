import { createTour } from "virtualtour";

export function lockedTour() {
  const tour = createTour({ steps: [{ target: "#menu", title: "Menu" }] });
  let previous = "";
  tour.on("started", () => {
    previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  });
  tour.on("deactivated", () => {
    document.body.style.overflow = previous;
  });
  return tour;
}
