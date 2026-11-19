import { createTour } from "virtualtour";

export const tour = createTour({
  id: "boundary",
  steps: [
    {
      id: "inside-scroller",
      target: "#row-12",
      title: "Stays inside the list",
      placement: { side: "bottom" },
    },
    {
      id: "whole-viewport",
      target: "#row-14",
      title: "May leave the list",
      placement: { side: "bottom" },
      position: { boundary: "viewport" },
    },
  ],
});
