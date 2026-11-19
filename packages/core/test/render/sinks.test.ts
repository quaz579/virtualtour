import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, tours } from "../../src/index";
import type { Tour, TourConfig } from "../../src/index";
import { setCurrentTour } from "../../src/registry";
import { engineOf } from "../../src/tour";
import { popoverText } from "../../src/engine/tour/step";
import { findExecutable, FLAG, PAYLOADS, pwned, stripSanitizer } from "../payloads";

const created: Tour[] = [];

afterEach(() => {
  for (const tour of created.splice(0)) if (tour.isRunning()) tour.finish();
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  delete (window as unknown as Record<string, unknown>)[FLAG];
  vi.restoreAllMocks();
});

async function show(config: TourConfig): Promise<Tour> {
  const tour = createTour({ animate: false, ...config });
  created.push(tour);
  await tour.start();
  return tour;
}

const wrapper = () => document.querySelector<HTMLElement>(".vt-popover")!;
const markup = (payload: string) => `ok ${payload} end`;

describe.each(Object.entries(PAYLOADS))("%s payload through every tour sink", (_name, payload) => {
  it("title, string body, array body, instruction, counter and labels", async () => {
    const sanitize = vi.fn(stripSanitizer);
    await show({
      sanitize,
      counter: () => markup(payload),
      labels: { next: markup(payload), back: markup(payload), done: markup(payload) },
      steps: [
        { id: "a", title: markup(payload), body: markup(payload), instruction: markup(payload) },
        { id: "b", title: "B", body: [markup(payload), markup(payload)] },
      ],
    });
    expect(findExecutable(wrapper())).toEqual([]);
    expect(sanitize).toHaveBeenCalled();
    expect(pwned()).toBeUndefined();
  });

  it("function-valued title, body and instruction", async () => {
    await show({
      sanitize: stripSanitizer,
      steps: [{ title: () => markup(payload), body: () => markup(payload), instruction: () => markup(payload) }],
    });
    expect(findExecutable(wrapper())).toEqual([]);
    expect(pwned()).toBeUndefined();
  });

  it("updatePopover, nudge patch and nudge message", async () => {
    const tour = await show({ sanitize: stripSanitizer, steps: [{ title: "T", body: "b", instruction: "Do it" }] });
    const engine = engineOf(tour)!;
    engine.updatePopover({
      title: markup(payload),
      description: markup(payload),
      instruction: markup(payload),
      progressText: markup(payload),
      nextBtnText: markup(payload),
      prevBtnText: markup(payload),
    });
    expect(findExecutable(wrapper())).toEqual([]);
    engine.nudge({ instruction: markup(payload) });
    expect(findExecutable(wrapper())).toEqual([]);
    engine.nudge(markup(payload));
    expect(wrapper().querySelector(".vt-popover-feedback")!.textContent).toContain("ok");
    expect(findExecutable(wrapper())).toEqual([]);
    expect(pwned()).toBeUndefined();
  });
});

describe("Element and DocumentFragment bodies", () => {
  it("leave the original element in place and intact across close and a second mount", async () => {
    const el = document.createElement("section");
    el.id = "orig";
    el.innerHTML = "<b>kept</b>";
    document.body.append(el);
    const tour = createTour({ animate: false, steps: [{ title: "T", body: el }] });
    created.push(tour);

    await tour.start();
    expect(el.parentElement).toBe(document.body);
    expect(el.innerHTML).toBe("<b>kept</b>");
    expect(document.querySelector(".vt-body")!.textContent).toBe("kept");

    tour.finish();
    expect(document.querySelector(".vt-body")).toBeNull();
    expect(el.isConnected).toBe(true);
    expect(el.innerHTML).toBe("<b>kept</b>");

    await tour.start();
    expect(document.querySelector(".vt-body")!.textContent).toBe("kept");
    expect(el.innerHTML).toBe("<b>kept</b>");
  });

  it("keep a detached element intact and render it again on every show of the step", async () => {
    const el = document.createElement("p");
    el.textContent = "detached";
    const tour = await show({ steps: [{ id: "a", title: "A", body: el }, { id: "b", title: "B", body: "x" }] });
    await tour.forward();
    await tour.backward();
    expect(document.querySelector(".vt-body")!.textContent).toBe("detached");
    expect(el.parentNode).toBeNull();
    expect(el.textContent).toBe("detached");
  });

  it("keep a DocumentFragment populated after the first mount", async () => {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement("i"), document.createTextNode(" frag"));
    fragment.querySelector("i")!.textContent = "one";
    const tour = await show({ steps: [{ id: "a", title: "A", body: fragment }, { id: "b", title: "B", body: "x" }] });
    expect(document.querySelector(".vt-body")!.innerHTML).toBe("<i>one</i> frag");
    expect(fragment.childNodes).toHaveLength(2);
    await tour.forward();
    await tour.backward();
    expect(document.querySelector(".vt-body")!.innerHTML).toBe("<i>one</i> frag");
    expect(fragment.childNodes).toHaveLength(2);
  });
});

describe("live region text", () => {
  it("popoverText includes the Element body", async () => {
    const el = document.createElement("div");
    el.textContent = "body words";
    await show({ steps: [{ title: "Title", body: el, instruction: "Do it" }] });
    const popover = engineOf(created[0]!)!.getState("popover");
    expect(popoverText(popover)).toEqual(["Title", "", "body words", "Do it"]);
  });

  it("is announced when the popover renders with focus kept inside the target", async () => {
    const field = document.createElement("input");
    field.id = "field";
    document.body.append(field);
    field.focus();
    const el = document.createElement("div");
    el.textContent = "body words";
    const tour = await show({
      steps: [
        { id: "a", title: "A", target: "#field", body: "x" },
        { id: "b", title: "Title B", target: "#field", body: el },
      ],
    });
    field.focus();
    await tour.forward();
    field.focus();
    const live = document.querySelector(".vt-live-region")!.textContent;
    expect(live).toContain("Title B");
    expect(live).toContain("body words");
  });
});

describe("click exemption", () => {
  it("does not prevent the default of a click on a pressable-classed element inside .vt-body", async () => {
    const el = document.createElement("div");
    el.innerHTML = `<button class="vt-popover-next-btn" type="button">fake</button>`;
    await show({ steps: [{ id: "a", title: "A", body: el }, { id: "b", title: "B", body: "x" }] });
    const fake = document.querySelector<HTMLElement>(".vt-body button")!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fake.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    const real = document.querySelector<HTMLElement>(".vt-popover-next-btn:not(.vt-body *)")!;
    const realEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    real.dispatchEvent(realEvent);
    expect(realEvent.defaultPrevented).toBe(true);
  });
});
