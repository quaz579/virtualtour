import { TourProvider } from "virtual-site-tour-react";
import type { TourConfig } from "virtual-site-tour";

function configFor(locale: string): TourConfig {
  return {
    id: `welcome-${locale}`,
    labels: locale === "de" ? { next: "Weiter", back: "Zurueck", done: "Fertig" } : {},
    steps: [{ id: "intro", title: locale === "de" ? "Willkommen" : "Welcome" }],
  };
}

export function LocalizedTour(props: { locale: string }) {
  return <TourProvider key={props.locale} config={configFor(props.locale)} autoStart />;
}
