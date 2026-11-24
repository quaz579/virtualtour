import { createTour } from "virtual-site-tour";

export const tour = createTour({
  id: "flip-shift",
  steps: [
    { id: "default", target: "#a", title: "Flip and shift on", placement: { side: "bottom" } },
    {
      id: "fixed-side",
      target: "#b",
      title: "Stays on the requested side",
      placement: { side: "bottom" },
      position: { flip: false },
    },
    {
      id: "free-edge",
      target: "#c",
      title: "May cross the boundary edge",
      placement: { side: "top", align: "end" },
      position: { shift: false },
    },
    {
      id: "inset",
      target: "#d",
      title: "Keeps 16 px from the edges",
      position: { viewportPadding: 16 },
    },
  ],
});
