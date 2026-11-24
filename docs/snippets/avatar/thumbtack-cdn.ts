import { createTour } from "virtual-site-tour";
import { thumbtackPack, withAvatar } from "virtual-site-tour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack("https://assets.your-company.example/virtualtour/"), { loadTimeoutMs: 5000 }),
  steps: [{ id: "hello", title: "Welcome" }],
});
