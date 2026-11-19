import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";
import { TourProvider, useTour } from "../src/index";

const View = defineComponent({
  setup() {
    const { isRunning, currentStep } = useTour();
    return () => h("p", `${isRunning.value}:${currentStep.value === null}`);
  },
});

describe("server rendering without a DOM", () => {
  it("renders the provider and composable", async () => {
    expect(typeof document).toBe("undefined");
    const app = createSSRApp({
      render: () =>
        h(TourProvider, { config: { steps: [{ title: "A", body: "a" }] }, autoStart: true }, { default: () => h(View) }),
    });
    expect(await renderToString(app)).toContain("false:true");
  });
});
