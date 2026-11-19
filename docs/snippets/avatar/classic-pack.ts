import { createTour } from "virtualtour";
import { loadClassicAvatarPack, withAvatar } from "virtualtour/avatar";

const pack = loadClassicAvatarPack({
  sheetUrl: "https://assets.your-company.example/avatars/classic/map.png",
  mapUrl: "https://assets.your-company.example/avatars/classic/animations.json",
  frameSize: { w: 124, h: 93 },
  roles: { greet: "Greeting" },
});

export const tour = createTour({
  presenter: withAvatar(pack, { onError: (error) => console.warn(error.message) }),
  steps: [{ id: "hello", title: "Welcome" }],
});

export async function licenseOf(): Promise<string | undefined> {
  return (await pack).license?.name;
}
