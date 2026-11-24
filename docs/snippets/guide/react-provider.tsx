import { TourProvider, useTour } from "virtual-site-tour-react";
import type { TourConfig } from "virtual-site-tour";

const config: TourConfig = {
  id: "welcome",
  exitPrompt: "Leave the tour?",
  steps: [
    { id: "save", target: "#save", title: "Save your work", body: "Changes stay in this browser until you press Save." },
    { id: "done", title: "That is all" },
  ],
};

function TourControls() {
  const { start, forward, exit, isRunning, currentStep } = useTour();
  if (!isRunning) {
    return (
      <button type="button" onClick={() => void start()}>
        Take the tour
      </button>
    );
  }
  return (
    <div>
      <span>Now showing {currentStep?.id}</span>
      <button type="button" onClick={() => void forward()}>
        Next
      </button>
      <button type="button" onClick={() => void exit()}>
        Stop
      </button>
    </div>
  );
}

export function App() {
  return (
    <TourProvider config={config} autoStart={false}>
      <TourControls />
    </TourProvider>
  );
}
