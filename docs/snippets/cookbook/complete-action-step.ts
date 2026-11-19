import { createTour } from "virtualtour";

export function actionTour(form: HTMLFormElement) {
  const tour = createTour({
    steps: [
      { id: "fill", target: "#name", title: "Your name", instruction: "Type a name.", advanceDelay: 400 },
      { id: "done", title: "Thanks" },
    ],
  });
  form.addEventListener("submit", () => tour.advance());
  return tour;
}
