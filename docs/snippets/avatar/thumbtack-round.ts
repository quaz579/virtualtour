import { createTour } from "virtual-site-tour";
import { thumbtackPack, withAvatar } from "virtual-site-tour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack(undefined, { variant: "round" })),
  steps: [{ id: "hello", title: "Welcome" }],
});
