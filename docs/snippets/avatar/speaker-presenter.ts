import { createTour } from "virtualtour";
import { SpeakerPresenter, thumbtackPack } from "virtualtour/avatar";

export async function tourWithSpeaker() {
  const pack = await thumbtackPack();
  return createTour({
    presenter: (tour, context) =>
      new SpeakerPresenter(tour, pack, {
        namespace: context.namespace,
        fadeMs: context.fadeMs,
        dock: "auto",
        ...(context.sanitize ? { sanitize: context.sanitize } : {}),
      }),
    steps: [{ id: "hello", title: "Welcome" }],
  });
}
