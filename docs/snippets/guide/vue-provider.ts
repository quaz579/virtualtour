import { defineComponent, h } from "vue";
import { TourProvider, useTour } from "virtualtour-vue";
import type { TourConfig } from "virtualtour";

const config: TourConfig = {
  id: "welcome",
  exitPrompt: () => window.confirm("Leave the tour?"),
  steps: [
    { id: "save", target: "#save", title: "Save your work", body: "Changes stay in this browser until you press Save." },
    { id: "done", title: "That is all" },
  ],
};

const TourControls = defineComponent({
  setup() {
    const { start, forward, exit, isRunning, currentStep } = useTour();
    return () =>
      isRunning.value
        ? h("div", [
            h("span", `Now showing ${currentStep.value?.id ?? ""}`),
            h("button", { type: "button", onClick: () => void forward() }, "Next"),
            h("button", { type: "button", onClick: () => void exit() }, "Stop"),
          ])
        : h("button", { type: "button", onClick: () => void start() }, "Take the tour");
  },
});

export const App = defineComponent({
  setup() {
    return () => h(TourProvider, { config, autoStart: false }, { default: () => h(TourControls) });
  },
});
