import { createTour } from "virtualtour";
import type { ButtonConfig, Presenter, PresenterFactory, RepositionInfo, StepParts, Tour, TourStep } from "virtualtour";

type Popover = Parameters<Presenter["mount"]>[0];

function textOf(value: string | (() => string)): string {
  return typeof value === "function" ? value() : value;
}

class CardPresenter implements Presenter {
  readonly layout = "dialog" as const;
  private parts: StepParts | null = null;
  private readonly tour: Tour;
  private readonly namespace: string;

  constructor(tour: Tour, namespace: string) {
    this.tour = tour;
    this.namespace = namespace;
  }

  async ready(): Promise<void> {
    await document.fonts.ready;
  }

  mount(popover: Popover, step: TourStep, parts: StepParts): void {
    this.parts = parts;
    popover.wrapper.classList.add("card-popover");
    popover.wrapper.setAttribute(`data-${this.namespace}-step`, String(this.tour.steps.indexOf(step)));
    this.render(popover, step, parts);
  }

  afterShow(_popover: Popover, step: TourStep): void {
    if (step.config.focus === "first-button") this.parts?.buttons.find((button) => !button.disabled)?.focus();
  }

  afterReposition(popover: Popover, _step: TourStep, info: RepositionInfo): void {
    popover.wrapper.dataset["side"] = info.pinned ? "pinned" : info.side;
  }

  update(popover: Popover, step: TourStep, parts: StepParts): void {
    this.parts = parts;
    this.render(popover, step, parts);
  }

  beforeLeave(_step: TourStep): void {}

  unmount(): void {
    this.parts = null;
  }

  private render(popover: Popover, step: TourStep, parts: StepParts): void {
    popover.wrapper.querySelector(".card-body")?.remove();
    if (parts.content) {
      const body = document.createElement("div");
      body.className = "card-body";
      body.appendChild(parts.content.cloneNode(true));
      popover.description.after(body);
    }
    this.renderFooter(popover, step, parts);
  }

  private renderFooter(popover: Popover, step: TourStep, parts: StepParts): void {
    parts.footer?.remove();
    delete parts.footer;
    parts.buttons = [];
    const configs = step.config.buttons;
    if (!configs || configs.length === 0) return;
    const footer = document.createElement("div");
    footer.className = "card-footer";
    for (const config of configs) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = textOf(config.text);
      button.disabled = typeof config.disabled === "function" ? config.disabled() : (config.disabled ?? false);
      button.addEventListener("click", () => this.run(config, step));
      footer.append(button);
      parts.buttons.push(button);
    }
    popover.footer.after(footer);
    parts.footer = footer;
  }

  private run(config: ButtonConfig, step: TourStep): void {
    const action = config.action;
    if (typeof action === "function") action({ tour: this.tour, step });
    else if (action === "forward") void this.tour.forward();
    else if (action === "backward") void this.tour.backward();
    else if (action === "exit") void this.tour.exit();
    else this.tour.finish();
  }
}

export const cardPresenter: PresenterFactory = (tour, context) => new CardPresenter(tour, context.namespace);

export const tour = createTour({
  presenter: cardPresenter,
  steps: [
    {
      id: "welcome",
      title: "Welcome",
      body: "This step is drawn by a custom presenter.",
      buttons: [
        { text: "Skip", action: "exit", kind: "secondary" },
        { text: "Next", action: "forward" },
      ],
    },
    { id: "end", title: "Done", buttons: [{ text: "Finish", action: "finish" }] },
  ],
});
