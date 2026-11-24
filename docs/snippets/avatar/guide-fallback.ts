import { createTour } from "virtual-site-tour";
import { loadAvatarPack, withAvatar } from "virtual-site-tour/avatar";

const pack = loadAvatarPack("https://assets.your-company.example/avatars/robot/pack.json");

export const tour = createTour({
  presenter: withAvatar(pack, {
    loadTimeoutMs: 4000,
    onError: (error) => console.warn(`Avatar unavailable at ${error.path}: ${error.message}`),
  }),
  steps: [
    { id: "hello", title: "Welcome", body: "This step shows in a dialog if the pack is late." },
    { id: "next", title: "Next", body: "A late pack is used from the next run." },
  ],
});
