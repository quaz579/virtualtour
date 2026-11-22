import { createTour } from "virtualtour";
import { thumbtackPack, withAvatar } from "virtualtour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack(undefined, { variant: "round" })),
  steps: [{ id: "hello", title: "Welcome" }],
});
