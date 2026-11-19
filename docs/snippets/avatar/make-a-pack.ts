import { createTour } from "virtualtour";
import { normalizePack, resolveRole, validatePack, withAvatar } from "virtualtour/avatar";
import type { AvatarPack } from "virtualtour/avatar";

const json: unknown = {
  format: "virtualtour-avatar/1",
  name: "Blob",
  sheet: { src: "./blob.png", frameWidth: 64, frameHeight: 64, columns: 4, scale: 2 },
  animations: {
    rest: { frames: [{ col: 0, row: 0, ms: 100 }], still: 0 },
    wave: {
      frames: [
        { col: 1, row: 0, ms: 90 },
        { col: 2, row: 0, ms: 90 },
        { col: 3, row: 0, ms: 90 },
      ],
    },
    blink: {
      frames: [
        { col: 0, row: 1, ms: 60 },
        { col: 1, row: 1, ms: 60 },
      ],
      still: 0,
    },
  },
  roles: { rest: "rest", greet: "wave", idle: ["blink"] },
  bubble: { dock: "end", gap: 8 },
};

export const pack: AvatarPack = validatePack(json);

export const normalized = normalizePack(pack, "https://assets.your-company.example/avatars/blob/pack.json");

export const greeting: string = resolveRole(normalized, "greet");

export const tour = createTour({
  presenter: withAvatar(pack),
  steps: [{ id: "hello", title: "Welcome" }],
});
