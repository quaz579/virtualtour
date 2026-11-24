import { createTour } from "virtual-site-tour";

export const tour = createTour({
  id: "hooks",
  waitBudget: 8000,
  steps: [
    {
      id: "settings",
      target: "#settings-panel",
      title: "Settings",
      shouldShow: () => document.body.dataset["role"] === "admin",
      prepare: async () => {
        document.querySelector<HTMLElement>("#settings-toggle")?.click();
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
      hookTimeout: 3000,
      reveal: "smooth",
    },
    {
      id: "table",
      target: "#table",
      title: "Table",
      revealWith: (target) => {
        target.scrollIntoView({ block: "start" });
      },
    },
  ],
});
