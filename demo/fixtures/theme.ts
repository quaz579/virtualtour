import { createTour } from "../../packages/core/src/index";
import type { Tour } from "../../packages/core/src/index";

declare global {
  interface Window {
    vtTour: Tour;
  }
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);

  if (!params.has("plain")) await import("../../packages/core/src/styles/theme.css");

  const theme = params.get("theme");
  if (theme) document.documentElement.dataset["vtTheme"] = theme;

  const tour = createTour({
    name: "theme",
    dim: true,
    animate: params.has("animate"),
    steps: [
      { id: "first", title: "Themed step", body: "Body text for the theme check.", target: "#target", placement: { side: "bottom" }, position: { arrow: !params.has("noarrow") } },
      {
        id: "second",
        title: "Second step",
        body: "Another step.",
        buttons: [
          { text: "Later", kind: "secondary", action: "forward" },
          { text: "Got it", action: "forward" },
        ],
      },
    ],
  });

  window.vtTour = tour;

  document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => {
    void tour.start();
  });

  document.documentElement.dataset.ready = "true";
}

void main();
