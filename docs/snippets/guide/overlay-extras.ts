import { createTour } from "virtualtour";

export const tour = createTour({
  id: "extras",
  dim: true,
  steps: [
    {
      id: "filters",
      target: "#filter-bar",
      title: "Filters",
      body: "Try the search box while the tour is open.",
      spotlight: {
        extra: ["#search", ".results-header"],
        class: "tour-highlight",
        targetInteractive: "hover-only",
      },
    },
  ],
});
