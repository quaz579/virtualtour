import { createTour } from "virtual-site-tour";
import type { PresenterFactory } from "virtual-site-tour";

const factory: PresenterFactory = () => ({
  mount() {},
  afterShow() {},
  update() {},
  beforeLeave() {},
  unmount() {},
  afterReposition(popover, _step, info) {
    const wrapper = popover.wrapper;
    wrapper.dataset["side"] = info.side;
    wrapper.dataset["edge"] = info.physicalAlign;
    wrapper.dataset["rtl"] = String(info.rtl);
    wrapper.dataset["pinned"] = String(info.pinned);
    if (info.pinned || !info.targetRect) return;
    const gap = info.side === "bottom" ? info.wrapperRect.top - info.targetRect.bottom : null;
    if (gap !== null) wrapper.style.setProperty("--gap", `${gap}px`);
  },
});

export const tour = createTour({
  id: "reposition",
  presenter: factory,
  steps: [{ id: "a", target: "#a", title: "Observed", placement: { side: "bottom" } }],
});
