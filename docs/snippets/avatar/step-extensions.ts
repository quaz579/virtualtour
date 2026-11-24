import { createTour } from "virtual-site-tour";
import { thumbtackPack, withAvatar } from "virtual-site-tour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack(), { idle: true }),
  steps: [
    { id: "hello", title: "Welcome", extensions: { avatar: { animation: "greet" } } },
    { id: "form", target: "#form", title: "Fill this in", extensions: { avatar: { idle: false, dock: "start" } } },
    { id: "plain", title: "No character here", extensions: { avatar: { hidden: true } } },
  ],
});
