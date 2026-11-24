import "virtual-site-tour/base.css";
import "virtual-site-tour/avatar.css";
import { createTour } from "virtual-site-tour";
import { thumbtackPack, withAvatar } from "virtual-site-tour/avatar";

export const tour = createTour({
  presenter: withAvatar(thumbtackPack(), {
    dock: "auto",
    scale: 1,
    idle: true,
    idleQuietMs: 8000,
    loadTimeoutMs: 5000,
    onError: (error) => console.warn(`Avatar unavailable: ${error.message}`),
  }),
  steps: [
    { id: "hello", title: "Welcome", body: "Take a quick look around." },
    { id: "save", target: "#save", title: "Save", body: "Your work is kept here." },
  ],
});
