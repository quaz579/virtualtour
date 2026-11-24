import { createTour } from "virtual-site-tour";
import { thumbtackPack, withAvatar } from "virtual-site-tour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack()),
  steps: [{ id: "hello", title: "Welcome" }],
});
