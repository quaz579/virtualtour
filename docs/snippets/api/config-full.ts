import { createTour, localStorageStore } from "virtual-site-tour";

export const tour = createTour({
  id: "billing-intro",
  name: "Billing intro",
  namespace: "vt",
  dim: { padding: 8, radius: 6, opacity: 0.6, clickOutside: "exit" },
  keys: { escape: true, arrows: true },
  exitPrompt: "Leave the tour?",
  counter: (index, total) => `${index} / ${total}`,
  labels: { next: "Continue", back: "Previous", done: "Finish", close: "Close tour" },
  progress: { store: localStorageStore(), skipCompleted: true, resume: false },
  animate: true,
  waitBudget: 8000,
  stepDefaults: { hookTimeout: 5000, position: { offset: 12 } },
  steps: [
    { id: "invoices", target: "#invoices", title: "Invoices" },
    { id: "done", title: "That is all" },
  ],
});
