import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTour, parseTourJson, serializeTour, TourEnvironmentError, TourJsonError, tours } from "../../src/index";
import type { TourJsonHandler, TourJsonV1 } from "../../src/index";
import { setCurrentTour } from "../../src/registry";
import { nextFrame } from "../engine/utils";

const here = dirname(fileURLToPath(import.meta.url));
const examples = resolve(here, "../../../../docs/examples/tours");
const example = (name: string): TourJsonV1 => JSON.parse(readFileSync(resolve(examples, name), "utf8")) as TourJsonV1;

const handlers = {
  confirmExit: () => true,
  counterText: () => "x",
  titleFor: () => "Title",
  openSettings: () => undefined,
  isBillingVisible: () => true,
  openBillingPanel: () => undefined,
  customScroll: () => undefined,
} satisfies Record<string, TourJsonHandler>;

const names = new Map<TourJsonHandler, string>(Object.entries(handlers).map(([name, fn]) => [fn, name]));

const base = (): TourJsonV1 => ({ format: "virtualtour-tour/1", steps: [] });

function errorOf(run: () => unknown): TourJsonError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(TourJsonError);
    return error as TourJsonError;
  }
  throw new Error("expected TourJsonError");
}

afterEach(() => {
  tours.off();
  setCurrentTour(null);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("parseTourJson", () => {
  it("parses the full example into the expected TourConfig", () => {
    document.body.innerHTML = `<div id="app"></div>`;
    const config = parseTourJson(example("billing-intro.json"), { handlers });
    const { mountIn, dimMountIn, ...rest } = config;

    expect(mountIn).toBeTypeOf("function");
    expect((mountIn as () => Element)()).toBe(document.getElementById("app"));
    expect((dimMountIn as () => Element)()).toBe(document.getElementById("app"));
    expect(rest).toEqual({
      id: "billing-intro",
      name: "Billing introduction",
      dim: {
        padding: 10,
        radius: { topLeft: 5, topRight: 5, bottomRight: 12, bottomLeft: 12 },
        transitionMs: 400,
        color: "#000",
        opacity: 0.7,
        clickOutside: "none",
        pageScroll: true,
        lockScrollParent: false,
        clipToScrollParents: true,
      },
      namespace: "vt",
      keys: { escape: true, arrows: true },
      exitPrompt: handlers.confirmExit,
      counter: handlers.counterText,
      labels: { next: "Next", back: "Back", done: "Done", close: "Close" },
      animate: true,
      waitBudget: 8000,
      stepDefaults: { position: { offset: 10, viewportPadding: 8 }, whenMissing: "center" },
      steps: [
        {
          id: "welcome",
          title: "Welcome to billing",
          body: ["Review invoices here.", "Takes about a minute."],
          closeButton: true,
          classes: ["intro"],
          meta: { analyticsId: "s-0" },
        },
        {
          id: "save",
          title: handlers.titleFor,
          body: "Click <b>Save</b>.",
          label: "Save step",
          buttons: [
            { text: "Back", action: "backward", kind: "secondary" },
            { text: "Next", action: "forward" },
            { text: "Open settings", action: handlers.openSettings },
          ],
          target: "#save",
          placement: { side: "bottom", align: "start" },
          position: {
            offset: { main: 10, cross: 0 },
            viewportPadding: 8,
            boundary: "scrollParents",
            flip: true,
            shift: true,
            strategy: "fixed",
            arrow: { minInset: 15 },
          },
          waitFor: 3000,
          whenMissing: "skip",
          shouldShow: handlers.isBillingVisible,
          prepare: handlers.openBillingPanel,
          hookTimeout: 5000,
          spotlight: { padding: 6, radius: 8, extra: ["#save-hint"], class: "glow", targetInteractive: true },
          reveal: "smooth",
          revealWith: handlers.customScroll,
          autoAdvance: { event: "click", selector: "#save", strict: false },
          instruction: "Click Save to continue.",
          advanceDelay: 600,
          focus: "dialog",
          extensions: { avatar: { animation: "point.left" } },
        },
      ],
    });
  });

  it("accepts the document as text and drops the schema reference and format", () => {
    const config = parseTourJson(JSON.stringify({ $schema: "x.json", ...base(), name: "N" }));
    expect(config).toEqual({ name: "N", steps: [] });
  });

  it("keeps a body array as string[] and passes extensions and meta through untouched", () => {
    const extensions = { avatar: { animation: "wave" }, anything: [1, { a: null }] };
    const meta = { nested: [1, 2, { three: 3 }] };
    const config = parseTourJson({ ...base(), steps: [{ body: ["a", "b"], meta, extensions }] });
    const step = config.steps![0]!;
    expect(step.body).toEqual(["a", "b"]);
    expect(Array.isArray(step.body)).toBe(true);
    expect(step.extensions).toBe(extensions);
    expect(step.meta).toBe(meta);
  });

  it("resolves a handler only from own properties of the handlers map", () => {
    const doc = { ...base(), exitPrompt: { handler: "constructor" } };
    expect(errorOf(() => parseTourJson(doc, { handlers })).path).toBe("exitPrompt.handler");
  });

  it("turns a mountIn selector into a thunk that throws TourEnvironmentError naming the path", () => {
    const config = parseTourJson({ ...base(), mountIn: "#nope", dimMountIn: "#also-nope" });
    expect(() => (config.mountIn as () => Element)()).toThrow(TourEnvironmentError);
    expect(() => (config.mountIn as () => Element)()).toThrow(/^mountIn: no element matches "#nope"$/);
    expect(() => (config.dimMountIn as () => Element)()).toThrow(/^dimMountIn: /);
  });

  const cases: [string, unknown, string, RegExp][] = [
    ["a bad format", { ...base(), format: "virtualtour-tour/2" }, "format", /expected "virtualtour-tour\/1"/],
    ["a missing format", { steps: [] }, "format", /required/],
    ["a missing steps list", { format: "virtualtour-tour/1" }, "steps", /required/],
    ["a non-object document", [], "", /expected an object/],
    ["invalid JSON text", "{nope", "", /invalid JSON/],
    ["an unknown top-level key", { ...base(), typo: 1 }, "typo", /unknown key/],
    ["an unknown step key", { ...base(), steps: [{}, { titel: "x" }] }, "steps[1].titel", /unknown key/],
    ["an unknown handler", { ...base(), steps: [{ buttons: [{ text: "x", action: { handler: "missing" } }] }] }, "steps[0].buttons[0].action.handler", /no handler named "missing"/],
    ["a handler object with an extra key", { ...base(), steps: [{ shouldShow: { handler: "isBillingVisible", extra: 1 } }] }, "steps[0].shouldShow.extra", /unknown key/],
    ["a handler object with no name", { ...base(), steps: [{ prepare: {} }] }, "steps[0].prepare.handler", /required/],
    ["a handler name that is not a string", { ...base(), steps: [{ prepare: { handler: 3 } }] }, "steps[0].prepare.handler", /string/],
    ["a wrong type", { ...base(), steps: [{ title: 5 }] }, "steps[0].title", /string or a handler/],
    ["a non-array steps", { ...base(), steps: {} }, "steps", /array/],
    ["a body list with a non-string", { ...base(), steps: [{ body: ["a", 2] }] }, "steps[0].body[1]", /string/],
    ["an offset object with an unknown key", { ...base(), steps: [{ position: { offset: { main: 1, sideways: 2 } } }] }, "steps[0].position.offset.sideways", /unknown key/],
    ["an invalid placement side", { ...base(), steps: [{ placement: { side: "diagonal" } }] }, "steps[0].placement.side", /expected one of/],
    ["a placement object without a side", { ...base(), steps: [{ placement: { align: "start" } }] }, "steps[0].placement.side", /required/],
    ["a placement string other than auto", { ...base(), steps: [{ placement: "top" }] }, "steps[0].placement", /"auto"/],
    ["an invalid namespace", { ...base(), namespace: "1bad" }, "namespace", /must match/],
    ["an opacity above 1", { ...base(), dim: { opacity: 2 } }, "dim.opacity", /at most 1/],
    ["a negative corner radius", { ...base(), dim: { radius: { topLeft: -1 } } }, "dim.radius.topLeft", /at least 0/],
    ["a negative waitFor", { ...base(), steps: [{ waitFor: -1 }] }, "steps[0].waitFor", /at least 0/],
    ["a non-finite number", { ...base(), steps: [{ advanceDelay: Infinity }] }, "steps[0].advanceDelay", /finite/],
    ["exitPrompt true", { ...base(), exitPrompt: true }, "exitPrompt", /false/],
    ["a button without an action", { ...base(), steps: [{ buttons: [{ text: "x" }] }] }, "steps[0].buttons[0].action", /required/],
    ["a button attrs value that is not a string", { ...base(), steps: [{ buttons: [{ text: "x", action: "exit", attrs: { a: 1 } }] }] }, "steps[0].buttons[0].attrs.a", /string/],
    ["a stepDefaults id", { ...base(), stepDefaults: { id: "x" } }, "stepDefaults.id", /unknown key/],
    ["an extensions array", { ...base(), steps: [{ extensions: [] }] }, "steps[0].extensions", /object/],
    ["a mountIn element-like object", { ...base(), mountIn: {} }, "mountIn", /selector/],
  ];

  it.each(cases)("reports the JSON path for %s", (_name, doc, path, message) => {
    const error = errorOf(() => parseTourJson(doc, { handlers }));
    expect(error.path).toBe(path);
    expect(error.message).toMatch(message);
    expect(error.message.startsWith(`${path || "$"}: `)).toBe(true);
  });
});

describe("serializeTour", () => {
  it("round-trips every example", () => {
    for (const name of ["billing-intro.json", "minimal.json", "action-steps.json"]) {
      const doc = example(name);
      const { $schema: _ignored, ...expected } = doc;
      const back = serializeTour(parseTourJson(doc, { handlers }), { handlerNames: names });
      expect(back).toEqual(expected);
      expect(JSON.parse(JSON.stringify(back))).toEqual(expected);
    }
  });

  it("writes format first and an empty steps list for a bare config", () => {
    expect(Object.keys(serializeTour({}))).toEqual(["format", "steps"]);
    expect(serializeTour({}).steps).toEqual([]);
  });

  it("writes element targets and mount elements through elementSelectors", () => {
    document.body.innerHTML = `<div id="app"></div><button id="go"></button>`;
    const app = document.getElementById("app")!;
    const go = document.getElementById("go")!;
    const doc = serializeTour(
      { mountIn: app, dimMountIn: app, steps: [{ target: go }, { target: "#plain" }] },
      { elementSelectors: new Map([[app, "#app"], [go, "#go"]]) },
    );
    expect(doc).toEqual({
      format: "virtualtour-tour/1",
      mountIn: "#app",
      dimMountIn: "#app",
      steps: [{ target: "#go" }, { target: "#plain" }],
    });
  });

  it("names a function target through handlerNames", () => {
    const find = () => "#x";
    const doc = serializeTour({ steps: [{ target: find }] }, { handlerNames: new Map([[find, "find"]]) });
    expect(doc.steps[0]!.target).toEqual({ handler: "find" });
  });

  it("throws with the path for a function that has no registered name", () => {
    const error = errorOf(() => serializeTour({ steps: [{ buttons: [{ text: "x", action: () => undefined }] }] }));
    expect(error.path).toBe("steps[0].buttons[0].action");
    expect(error.message).toMatch(/no registered handler name/);
  });

  it("throws with the path for an element that has no registered selector", () => {
    document.body.innerHTML = `<i id="e"></i>`;
    const element = document.getElementById("e")!;
    expect(errorOf(() => serializeTour({ steps: [{ target: element }] })).path).toBe("steps[0].target");
    expect(errorOf(() => serializeTour({ mountIn: element })).path).toBe("mountIn");
  });

  it("throws for code-only keys and forms", () => {
    document.body.innerHTML = `<i id="e"></i>`;
    const element = document.getElementById("e")!;
    expect(errorOf(() => serializeTour({ sanitize: (html) => html })).path).toBe("sanitize");
    expect(errorOf(() => serializeTour({ presenter: () => ({}) as never })).path).toBe("presenter");
    expect(errorOf(() => serializeTour({ steps: [{ body: element }] })).path).toBe("steps[0].body");
    expect(errorOf(() => serializeTour({ steps: [{ body: () => "x" }] })).path).toBe("steps[0].body");
    expect(errorOf(() => serializeTour({ mountIn: () => element })).path).toBe("mountIn");
  });

  it("throws for a value JSON cannot carry", () => {
    expect(errorOf(() => serializeTour({ steps: [{ hookTimeout: Infinity }] })).path).toBe("steps[0].hookTimeout");
    expect(errorOf(() => serializeTour({ waitBudget: Infinity })).path).toBe("waitBudget");
  });
});

describe("parsed tours run on the real engine", () => {
  it("starts a tour with an action step and a per-corner radius", async () => {
    document.body.innerHTML = `<button id="save" type="button">Save</button>`;
    const target = document.getElementById("save")!;
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 50, 200, 80));
    const clicked = vi.fn();
    const config = parseTourJson(
      {
        format: "virtualtour-tour/1",
        id: "json-run",
        animate: false,
        dim: { padding: 0, radius: { topLeft: 1, topRight: 2, bottomRight: 3, bottomLeft: 4 } },
        steps: [
          {
            id: "save",
            target: "#save",
            title: "Save",
            instruction: "Click <b>Save</b>.",
            autoAdvance: { event: "click", strict: false },
            buttons: [{ text: "Skip", action: { handler: "skip" } }],
          },
          { id: "done", title: "Saved" },
        ],
      },
      { handlers: { skip: clicked } },
    );
    const tour = createTour(config);
    await tour.start();

    const wrapper = document.querySelector<HTMLElement>(".vt-popover")!;
    expect(wrapper.querySelector(".vt-popover-instruction-text")!.textContent).toBe("Click Save.");
    const d = document.querySelector("[data-vt-overlay] path")!.getAttribute("d")!;
    const arcs = [...d.split("Z")[1]!.matchAll(/a(\d+),(\d+) 0 0 1/g)].map((m) => Number(m[1]));
    expect(arcs).toEqual([2, 3, 4, 1]);

    [...wrapper.querySelectorAll("button")].find((b) => b.textContent === "Skip")!.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    target.click();
    await nextFrame();
    await vi.waitFor(() => expect(document.querySelector(".vt-popover-title")?.textContent).toBe("Saved"));
    tour.finish();
  });
});

describe("tour-json module hygiene", () => {
  it("never builds code from strings", () => {
    const source = readFileSync(resolve(here, "../../src/json/tour-json.ts"), "utf8");
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/\bFunction\s*\(/);
    expect(source).not.toMatch(/new\s+Function\b/);
    expect(source).not.toMatch(/\bimport\s*\(/);
  });
});
