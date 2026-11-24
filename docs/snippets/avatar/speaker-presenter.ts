import { createTour } from "virtual-site-tour";
import { SpeakerPresenter, thumbtackPack } from "virtual-site-tour/avatar";

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
