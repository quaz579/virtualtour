import { createTour } from "virtualtour";
import { thumbtackPack, withAvatar } from "virtualtour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack("https://assets.your-company.example/virtualtour/"), { loadTimeoutMs: 5000 }),
  steps: [{ id: "hello", title: "Welcome" }],
});
