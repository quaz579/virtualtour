import { defineComponent, h } from "vue";
import { TourProvider } from "virtualtour-vue";
import type { TourConfig } from "virtualtour";

function configFor(locale: string): TourConfig {
  return {
    id: `welcome-${locale}`,
    steps: [{ id: "intro", title: locale === "de" ? "Willkommen" : "Welcome" }],
  };
}

export const LocalizedTour = defineComponent({
  props: { locale: { type: String, required: true } },
  setup(props) {
    return () => h(TourProvider, { key: props.locale, config: configFor(props.locale), autoStart: true });
  },
});
