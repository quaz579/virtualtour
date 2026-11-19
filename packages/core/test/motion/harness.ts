import { vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour, TourConfig } from "../../src/index";
import { setCurrentTour } from "../../src/registry";

export interface FakeAnimation extends EventTarget {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  element: Element;
  cancel: ReturnType<typeof vi.fn>;
  finish(): void;
}

export const animations: FakeAnimation[] = [];
const created: Tour[] = [];
export let positions: Record<string, { left: number; top: number }> = {};

export function install(): void {
  animations.length = 0;
  positions = {};
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = this.getAttribute("data-vt-step");
    const at = (index !== null && positions[index]) || { left: 0, top: 0 };
    return { ...at, right: at.left, bottom: at.top, width: 0, height: 0, x: at.left, y: at.top, toJSON() {} } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    writable: true,
    value: function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const target = new EventTarget() as FakeAnimation;
      target.keyframes = keyframes;
      target.options = options;
      target.element = this;
      target.cancel = vi.fn(() => target.dispatchEvent(new Event("cancel")));
      target.finish = () => target.dispatchEvent(new Event("finish"));
      animations.push(target);
      return target;
    },
  });
}

export function uninstall(): void {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  document.body.removeAttribute("data-vt-fade");
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

export async function start(config: TourConfig): Promise<Tour> {
  document.body.innerHTML = `<button id="a">A</button><button id="b">B</button><button id="c">C</button>`;
  const tour = createTour({ animate: true, ...config });
  created.push(tour);
  await tour.start();
  return tour;
}

export function wrapper(): HTMLElement {
  return document.querySelector<HTMLElement>(".vt-popover")!;
}
