import { createTour } from "virtualtour";
import { thumbtackPack, withAvatar } from "virtualtour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack()),
  steps: [{ id: "hello", title: "Welcome" }],
});
