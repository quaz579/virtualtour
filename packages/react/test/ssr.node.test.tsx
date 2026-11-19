import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TourProvider, useTour } from "../src/index";

function View() {
  const { isRunning, currentStep } = useTour();
  return <p>{`${isRunning}:${currentStep === null}`}</p>;
}

describe("server rendering without a DOM", () => {
  it("renders the provider and hook", () => {
    expect(typeof document).toBe("undefined");
    const html = renderToString(
      <TourProvider config={{ steps: [{ title: "A", body: "a" }] }} autoStart>
        <View />
      </TourProvider>,
    );
    expect(html).toContain("false:true");
  });
});
