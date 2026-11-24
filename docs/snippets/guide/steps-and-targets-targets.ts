import { createTour } from "virtual-site-tour";

const sidebar = document.querySelector("#sidebar");

export const tour = createTour({
  id: "targets",
  steps: [
    { id: "by-selector", target: "#save", title: "Save" },
    ...(sidebar ? [{ id: "by-element", target: sidebar, title: "Sidebar" }] : []),
    {
      id: "by-function",
      target: () => document.querySelector("[data-tour='search']"),
      title: "Search",
    },
    { id: "late", target: "#report", waitFor: 3000, whenMissing: "skip", title: "Report" },
    { id: "centered", title: "All done", body: "No target, so this step is centered." },
  ],
});
