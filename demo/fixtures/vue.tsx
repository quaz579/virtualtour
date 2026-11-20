import { createApp, defineComponent, h, onBeforeUnmount, ref } from "vue";
import { TourProvider, useTour } from "../../packages/vue/src/index";

const config = {
  name: "vue",
  animate: false,
  steps: [
    { id: "one", title: "One", body: "First.", target: "#first" },
    { id: "two", title: "Two", body: "Second.", target: "#second" },
    { id: "three", title: "Three", body: "Third.", target: "#third" },
  ],
};

const Controls = defineComponent({
  setup() {
    const { tour, isRunning, currentStep, start, forward, backward, exit } = useTour();
    const dropOnShow = new URLSearchParams(location.search).get("dropOnShow");
    const offs = [tour.on("exited", (e) => (document.documentElement.dataset["exitReason"] = e.reason))];
    const target = dropOnShow ? tour.stepById(dropOnShow) : undefined;
    if (dropOnShow && target) offs.push(target.on("will-show", () => tour.dropStep(dropOnShow)));
    onBeforeUnmount(() => offs.forEach((off) => off()));
    return () =>
      h("div", { class: "demo-container" }, [
        h("h1", "VirtualTour Vue fixture"),
        h("p", [
          "running: ",
          h("b", { id: "running" }, String(isRunning.value)),
          " step: ",
          h("b", { id: "step" }, currentStep.value?.id ?? "none"),
        ]),
        h("button", { id: "start", type: "button", onClick: () => void start() }, "Start tour"),
        h("button", { id: "hook-next", type: "button", onClick: () => void forward() }, "Hook next"),
        h("button", { id: "hook-back", type: "button", onClick: () => void backward() }, "Hook back"),
        h("button", { id: "hook-exit", type: "button", onClick: () => void exit() }, "Hook exit"),
        h(
          "button",
          { id: "hook-drop", type: "button", onClick: () => currentStep.value && tour.dropStep(currentStep.value) },
          "Hook drop",
        ),
        h("p", [
          h("button", { id: "first", type: "button" }, "First"),
          h("button", { id: "second", type: "button" }, "Second"),
          h("button", { id: "third", type: "button" }, "Third"),
        ]),
      ]);
  },
});

const Page = defineComponent({
  setup() {
    const mounted = ref(true);
    const autoStart = new URLSearchParams(location.search).get("autostart") === "1";
    return () => [
      h("button", { id: "unmount", type: "button", onClick: () => (mounted.value = false) }, "Unmount"),
      mounted.value
        ? h(TourProvider, { config, autoStart }, { default: () => h(Controls) })
        : h("p", { id: "gone" }, "unmounted"),
    ];
  },
});

createApp(Page).mount(document.getElementById("root") as HTMLElement);
document.documentElement.dataset["ready"] = "true";
