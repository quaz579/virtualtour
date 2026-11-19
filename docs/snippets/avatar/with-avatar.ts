import "virtualtour/base.css";
import "virtualtour/avatar.css";
import { createTour } from "virtualtour";
import { thumbtackPack, withAvatar } from "virtualtour/avatar";

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
