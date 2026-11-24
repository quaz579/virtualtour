import { createTour } from "virtual-site-tour";

export function showBadge(badge: HTMLElement) {
  const tour = createTour({ steps: [{ title: "One" }, { title: "Two" }] });
  tour.on("step-shown", () => {
    const { index, total } = tour.progressInfo();
    badge.textContent = `${index}/${total}`;
  });
  return tour;
}
