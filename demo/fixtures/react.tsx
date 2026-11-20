import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { TourProvider, useTour } from "../../packages/react/src/index";

const config = {
  name: "react",
  animate: false,
  steps: [
    { id: "one", title: "One", body: "First.", target: "#first" },
    { id: "two", title: "Two", body: "Second.", target: "#second" },
    { id: "three", title: "Three", body: "Third.", target: "#third" },
  ],
};

function Controls() {
  const { tour, isRunning, currentStep, start, forward, backward, exit } = useTour();
  useEffect(() => {
    const w = window as unknown as { vtStarts?: number };
    w.vtStarts ??= 0;
    return tour.on("started", () => {
      w.vtStarts = (w.vtStarts ?? 0) + 1;
    });
  }, [tour]);
  return (
    <div className="demo-container">
      <h1>VirtualTour React fixture</h1>
      <p>
        running: <b id="running">{String(isRunning)}</b> step: <b id="step">{currentStep?.id ?? "none"}</b>
      </p>
      <button id="start" type="button" onClick={() => void start()}>
        Start tour
      </button>
      <button id="hook-next" type="button" onClick={() => void forward()}>
        Hook next
      </button>
      <button id="hook-back" type="button" onClick={() => void backward()}>
        Hook back
      </button>
      <button id="hook-exit" type="button" onClick={() => void exit()}>
        Hook exit
      </button>
      <button id="hook-drop" type="button" onClick={() => currentStep && tour.dropStep(currentStep)}>
        Hook drop
      </button>
      <p>
        <button id="first" type="button">First</button>
        <button id="second" type="button">Second</button>
        <button id="third" type="button">Third</button>
      </p>
    </div>
  );
}

function Page() {
  const [mounted, setMounted] = useState(true);
  const params = new URLSearchParams(location.search);
  const autoStart = params.get("autostart") === "1";
  return (
    <>
      <button id="unmount" type="button" onClick={() => setMounted(false)}>
        Unmount
      </button>
      {mounted ? (
        <TourProvider config={config} autoStart={autoStart}>
          <Controls />
        </TourProvider>
      ) : (
        <p id="gone">unmounted</p>
      )}
    </>
  );
}

const root = createRoot(document.getElementById("root") as HTMLElement);
const strict = new URLSearchParams(location.search).get("strict") === "1";
root.render(strict ? <StrictMode><Page /></StrictMode> : <Page />);
document.documentElement.dataset["ready"] = "true";
