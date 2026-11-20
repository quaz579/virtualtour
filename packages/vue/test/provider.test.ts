import { createApp, defineComponent, h, nextTick, onMounted, shallowReactive } from "vue";
import type { App, Component } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tours } from "virtualtour";
import type { Tour, TourConfig } from "virtualtour";
import { TourProvider, useTour } from "../src/index";
import type { UseTourResult } from "../src/index";

const live = new Map<Tour, number>();
const failures = { start: false, exit: false };
const startCalls = new Map<Tour, number>();

vi.mock("virtualtour", async (importOriginal) => {
  const actual = await importOriginal<typeof import("virtualtour")>();
  return {
    ...actual,
    createTour(config: TourConfig) {
      const tour = actual.createTour(config);
      const on = tour.on.bind(tour) as (event: string, listener: never) => () => void;
      live.set(tour, 0);
      const start = tour.start.bind(tour);
      tour.start = () => {
        startCalls.set(tour, (startCalls.get(tour) ?? 0) + 1);
        return failures.start ? Promise.reject(new Error("boom")) : start();
      };
      if (failures.exit) tour.exit = () => Promise.reject(new Error("bang"));
      (tour as unknown as { on: typeof on }).on = (event, listener) => {
        live.set(tour, (live.get(tour) ?? 0) + 1);
        const off = on(event, listener);
        return () => {
          live.set(tour, (live.get(tour) ?? 0) - 1);
          off();
        };
      };
      return tour;
    },
  };
});

const apps: App[] = [];

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(async () => {
  for (const app of apps.splice(0)) app.unmount();
  await wait();
  tours.off();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const steps = (...ids: string[]) => ids.map((id) => ({ id, title: id.toUpperCase(), body: `Body ${id}` }));

function config(extra: Partial<TourConfig> = {}): TourConfig {
  return { animate: false, steps: steps("a", "b", "c"), ...extra };
}

interface Probe {
  latest: UseTourResult;
  renders: number;
}

function probeOf(): Probe {
  return { latest: undefined as unknown as UseTourResult, renders: 0 };
}

function capture(probe: Probe): Component {
  return defineComponent({
    setup() {
      const value = useTour();
      probe.latest = value;
      return () => {
        probe.renders += 1;
        return h("span", { "data-testid": "state" }, `${value.isRunning.value}:${value.currentStep.value?.id ?? "none"}`);
      };
    },
  });
}

interface Mounted {
  app: App;
  props: { config: TourConfig; autoStart: boolean };
  unmount(): void;
}

async function mount(probe: Probe, cfg: TourConfig = config(), autoStart = false): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const props = shallowReactive({ config: cfg, autoStart });
  const Child = capture(probe);
  const app = createApp({ render: () => h(TourProvider, props, { default: () => h(Child) }) });
  apps.push(app);
  app.mount(container);
  await nextTick();
  let alive = true;
  return {
    app,
    get props() {
      return props;
    },
    unmount() {
      if (!alive) return;
      alive = false;
      apps.splice(apps.indexOf(app), 1);
      app.unmount();
    },
  } as Mounted;
}

async function flush(): Promise<void> {
  await wait();
  await nextTick();
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i += 1) await wait(10);
  expect(check()).toBe(true);
}

const text = () => document.querySelector("[data-testid=state]")?.textContent;

describe("useTour values", () => {
  it("track the run through start, forward, backward and finish", async () => {
    const probe = probeOf();
    await mount(probe);
    expect(text()).toBe("false:none");

    await probe.latest.start();
    await nextTick();
    expect(text()).toBe("true:a");
    expect(probe.latest.isRunning.value).toBe(true);
    expect(probe.latest.currentStep.value).toBe(probe.latest.tour.steps[0]);

    await probe.latest.forward();
    await nextTick();
    expect(text()).toBe("true:b");
    await probe.latest.forward();
    await nextTick();
    expect(text()).toBe("true:c");
    await probe.latest.backward();
    await nextTick();
    expect(text()).toBe("true:b");

    probe.latest.finish();
    await nextTick();
    expect(text()).toBe("false:none");
  });

  it("updates when the run ends through exit", async () => {
    const probe = probeOf();
    await mount(probe);
    await probe.latest.start();
    expect(await probe.latest.exit()).toBe(true);
    await nextTick();
    expect(text()).toBe("false:none");
  });

  it("keeps refs in sync when popover buttons drive the tour", async () => {
    const probe = probeOf();
    await mount(probe);
    await probe.latest.start();
    await nextTick();
    document.querySelector<HTMLElement>(".vt-popover-next-btn")?.click();
    await until(() => text() === "true:b");
    document.querySelector<HTMLElement>(".vt-popover-prev-btn")?.click();
    await until(() => text() === "true:a");
    document.querySelector<HTMLElement>(".vt-popover-close-btn")?.click();
    await until(() => text() === "false:none");
  });

  it("updates when the tour is driven directly", async () => {
    const probe = probeOf();
    await mount(probe);
    await probe.latest.tour.goTo("c");
    await nextTick();
    expect(text()).toBe("true:c");
  });

  it("keeps the result object and methods stable", async () => {
    const probe = probeOf();
    await mount(probe);
    const first = probe.latest;
    await first.start();
    await first.forward();
    expect(probe.latest).toBe(first);
    expect(probe.latest.start).toBe(first.start);
    expect(probe.latest.forward).toBe(first.forward);
  });

  it("does not rerender consumers when nothing observable changed", async () => {
    const probe = probeOf();
    await mount(probe);
    await probe.latest.start();
    await nextTick();
    const before = probe.renders;
    await probe.latest.start();
    await nextTick();
    expect(probe.renders).toBe(before);
  });

  it("exposes readonly refs", async () => {
    const probe = probeOf();
    await mount(probe);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    (probe.latest.isRunning as { value: boolean }).value = true;
    expect(probe.latest.isRunning.value).toBe(false);
  });
});

describe("steps dropped mid-tour", () => {
  async function started(probe: Probe, cfg: TourConfig = config()): Promise<void> {
    await mount(probe, cfg);
    await probe.latest.start();
    await probe.latest.forward();
    await nextTick();
    expect(text()).toBe("true:b");
  }

  it("moves currentStep to the step that follows the dropped one", async () => {
    const probe = probeOf();
    await started(probe);
    probe.latest.tour.dropStep("b");
    await until(() => text() === "true:c");
    expect(probe.latest.currentStep.value).toBe(probe.latest.tour.steps[1]);
  });

  it("stops reporting the dropped step while the next step waits for its target", async () => {
    const probe = probeOf();
    await started(probe, {
      animate: false,
      steps: [
        { id: "a", title: "A", body: "a" },
        { id: "b", title: "B", body: "b" },
        { id: "c", title: "C", body: "c", target: "#never-there", waitFor: 400 },
      ],
    });
    const dropped = probe.latest.currentStep.value;
    probe.latest.tour.dropStep("b");
    await nextTick();
    expect(probe.latest.currentStep.value).not.toBe(dropped);
    await until(() => text() === "true:c");
  });

  it("reports the run ended when the last step on screen is dropped", async () => {
    const probe = probeOf();
    await started(probe, config({ steps: steps("a", "b") }));
    probe.latest.tour.dropStep("b");
    await until(() => text() === "false:none");
  });

  it("keeps currentStep when another step is dropped", async () => {
    const probe = probeOf();
    await started(probe);
    const before = probe.latest.currentStep.value;
    probe.latest.tour.dropStep("a");
    await nextTick();
    expect(probe.latest.currentStep.value).toBe(before);
    expect(text()).toBe("true:b");
  });

  it("follows the step after a drop and a later forward", async () => {
    const probe = probeOf();
    await started(probe, config({ steps: steps("a", "b", "c", "d") }));
    probe.latest.tour.dropStep("b");
    await until(() => text() === "true:c");
    probe.latest.tour.dropStep("c");
    await until(() => text() === "true:d");
  });

  it("stops following the tour after unmount", async () => {
    const probe = probeOf();
    const mounted = await mount(probe);
    await probe.latest.start();
    await nextTick();
    const tour = probe.latest.tour;
    const step = probe.latest.currentStep.value;
    mounted.unmount();
    await flush();
    const before = probe.latest.currentStep.value;
    tour.dropStep("a");
    await flush();
    expect(probe.latest.currentStep.value).toBe(before);
    expect(step).toBe(before);
  });
});

describe("currentStep during a move", () => {
  function movable(...ids: string[]): TourConfig {
    const target = document.createElement("div");
    target.id = "move-target";
    document.body.appendChild(target);
    return config({
      steps: ids.map((id) => ({ id, title: id.toUpperCase(), body: id, ...(id === "b" ? { target: "#move-target" } : {}) })),
    });
  }

  it("keeps the previous step until the next one is shown", async () => {
    const probe = probeOf();
    await mount(probe, movable("a", "b", "c"));
    await probe.latest.start();
    await nextTick();
    const seen: Array<string | undefined> = [];
    const tour = probe.latest.tour;
    tour.steps[1]!.on("will-show", () => {
      seen.push(tour.currentStep?.id);
      seen.push(probe.latest.currentStep.value?.id);
    });
    tour.steps[1]!.on("hidden", () => seen.push(probe.latest.currentStep.value?.id));
    await probe.latest.forward();
    await nextTick();
    expect(seen).toEqual([undefined, "a"]);
    expect(text()).toBe("true:b");
  });

  it("keeps the previous step through steps-changed, then moves on when the target is dropped", async () => {
    const probe = probeOf();
    await mount(probe, movable("a", "b", "c"));
    await probe.latest.start();
    const tour = probe.latest.tour;
    let during: string | undefined;
    tour.steps[1]!.on("will-show", () => {
      tour.appendStep({ id: "d", title: "D", body: "d" });
      during = probe.latest.currentStep.value?.id;
      tour.dropStep("b");
    });
    void probe.latest.forward();
    await until(() => text() === "true:c");
    expect(during).toBe("a");
  });

  it("ends the run when the move target is dropped and nothing follows it", async () => {
    const probe = probeOf();
    await mount(probe, movable("a", "b"));
    await probe.latest.start();
    const reasons: string[] = [];
    probe.latest.tour.on("exited", (p) => reasons.push(p.reason));
    probe.latest.tour.steps[1]!.on("will-show", () => probe.latest.tour.dropStep("b"));
    void probe.latest.forward();
    await until(() => text() === "false:none");
    expect(reasons).toEqual(["api"]);
  });

  it("reports null once the visible step is dropped with nothing after it", async () => {
    const probe = probeOf();
    await mount(probe, config({ steps: steps("a") }));
    await probe.latest.start();
    await nextTick();
    probe.latest.tour.dropStep("a");
    await until(() => text() === "false:none");
  });
});

describe("unmount", () => {
  it("mid-tour: exits without a prompt and detaches every listener it added", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const probe = probeOf();
    const mounted = await mount(probe, config({ exitPrompt: "Leave?" }));
    await probe.latest.start();
    const tour = probe.latest.tour;
    const target = tour.steps[1]!;
    const offs: Array<ReturnType<typeof vi.fn>> = [];
    const original = target.on.bind(target) as (event: string, fn: never) => () => void;
    vi.spyOn(target, "on").mockImplementation(((event: string, fn: never) => {
      const off = vi.fn(original(event, fn));
      offs.push(off);
      return off;
    }) as never);
    await probe.latest.forward();
    await nextTick();
    expect(text()).toBe("true:b");
    const step = probe.latest.currentStep.value!;
    const reasons: string[] = [];
    tour.on("exited", (p) => reasons.push(p.reason));

    mounted.unmount();
    await flush();

    expect(tour.isRunning()).toBe(false);
    expect(reasons).toEqual(["api"]);
    expect(confirm).not.toHaveBeenCalled();
    expect(live.get(tour)).toBe(2);
    expect(offs.length).toBeGreaterThan(0);
    for (const off of offs) expect(off).toHaveBeenCalled();
    expect(probe.latest.currentStep.value).toBe(step);
  });

  it("exits a running tour without asking the exit prompt", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const probe = probeOf();
    const mounted = await mount(probe, config({ exitPrompt: "Leave the tour?" }));
    await probe.latest.start();
    const tour: Tour = probe.latest.tour;
    const reasons: string[] = [];
    tour.on("exited", (p) => reasons.push(p.reason));
    expect(tour.isRunning()).toBe(true);

    mounted.unmount();
    await flush();

    expect(tour.isRunning()).toBe(false);
    expect(reasons).toEqual(["api"]);
    expect(confirm).not.toHaveBeenCalled();
    expect(document.querySelector(".vt-popover")).toBeNull();
  });

  it("exits without calling a function exit prompt", async () => {
    const prompt = vi.fn(async () => false);
    const probe = probeOf();
    const mounted = await mount(probe, config({ exitPrompt: prompt }));
    await probe.latest.start();
    const tour = probe.latest.tour;
    mounted.unmount();
    await flush();
    expect(tour.isRunning()).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("still honors the exit prompt while mounted", async () => {
    const prompt = vi.fn(async () => false);
    const probe = probeOf();
    await mount(probe, config({ exitPrompt: prompt }));
    await probe.latest.start();
    expect(await probe.latest.exit()).toBe(false);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(probe.latest.tour.isRunning()).toBe(true);

    prompt.mockResolvedValue(true);
    expect(await probe.latest.exit()).toBe(true);
    expect(probe.latest.tour.isRunning()).toBe(false);
  });

  it("honors a string exit prompt while mounted", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const probe = probeOf();
    await mount(probe, config({ exitPrompt: "Sure?" }));
    await probe.latest.start();
    expect(await probe.latest.exit()).toBe(false);
    expect(confirm).toHaveBeenCalledWith("Sure?");
    expect(probe.latest.tour.isRunning()).toBe(true);
  });

  it("ends a run that only begins after the provider unmounted", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = {
      load: async () => {
        await gate;
        return null;
      },
      save: () => {},
      clear: () => {},
    };
    const probe = probeOf();
    const mounted = await mount(probe, config({ id: "late", progress: { store } as never }), true);
    const tour = probe.latest.tour;
    expect(tour.isRunning()).toBe(false);
    mounted.unmount();
    await flush();
    release();
    await flush();
    await flush();
    expect(tour.isRunning()).toBe(false);
  });

  it("ends a run whose exit prompt is still pending when the provider unmounts, whatever the answer", async () => {
    for (const answer of [false, true]) {
      let resolvePrompt: (value: boolean) => void = () => {};
      const prompt = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePrompt = resolve;
          }),
      );
      const probe = probeOf();
      const mounted = await mount(probe, config({ exitPrompt: prompt }));
      await probe.latest.start();
      const tour = probe.latest.tour;
      const asked = probe.latest.exit();
      await flush();
      expect(prompt).toHaveBeenCalledTimes(1);
      mounted.unmount();
      await flush();
      resolvePrompt(answer);
      await asked;
      await flush();
      expect(tour.isRunning()).toBe(false);
      expect(document.querySelector(".vt-popover")).toBeNull();
    }
  });

  it("ends a run whose string exit prompt answered stay before the provider unmounted", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const probe = probeOf();
    const mounted = await mount(probe, config({ exitPrompt: "Sure?" }));
    await probe.latest.start();
    const tour = probe.latest.tour;
    expect(await probe.latest.exit()).toBe(false);
    mounted.unmount();
    await flush();
    expect(tour.isRunning()).toBe(false);
    expect(document.querySelector(".vt-popover")).toBeNull();
  });

  it("logs a failing exit on unmount instead of leaving an unhandled rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    failures.exit = true;
    const probe = probeOf();
    const mounted = await mount(probe);
    failures.exit = false;
    await probe.latest.start();
    mounted.unmount();
    await flush();
    expect(error).toHaveBeenCalledWith("[virtualtour-vue] exit on unmount failed:", expect.anything());
  });

  it("removes the listeners it added", async () => {
    const probe = probeOf();
    const mounted = await mount(probe);
    const tour = probe.latest.tour;
    expect(live.get(tour)).toBeGreaterThan(1);
    mounted.unmount();
    await flush();
    expect(live.get(tour)).toBe(1);
  });
});

describe("autoStart", () => {
  it("starts the tour once after mount", async () => {
    const probe = probeOf();
    await mount(probe, config(), true);
    await until(() => text() === "true:a");
  });

  it("starts exactly once", async () => {
    let started = 0;
    const probe = probeOf();
    const Spy = defineComponent({
      setup() {
        const { tour } = useTour();
        onMounted(() => {
          tour.on("started", () => (started += 1));
        });
        return () => null;
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Child = capture(probe);
    const app = createApp({
      render: () => h(TourProvider, { config: config(), autoStart: true }, { default: () => [h(Spy), h(Child)] }),
    });
    apps.push(app);
    app.mount(container);
    await until(() => text() === "true:a");
    await flush();
    expect(started).toBe(1);
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("calls start once and not at all when the tour is already running", async () => {
    const probe = probeOf();
    await mount(probe, config(), true);
    await until(() => text() === "true:a");
    expect(startCalls.get(probe.latest.tour)).toBe(1);
  });

  it("does not start when autoStart is off", async () => {
    const probe = probeOf();
    await mount(probe);
    await flush();
    expect(probe.latest.isRunning.value).toBe(false);
  });

  it("does not start a tour that is already running", async () => {
    const probe = probeOf();
    const Pre = defineComponent({
      setup() {
        const { tour } = useTour();
        onMounted(() => void tour.start());
        return () => null;
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Child = capture(probe);
    const app = createApp({
      render: () => h(TourProvider, { config: config(), autoStart: true }, { default: () => [h(Pre), h(Child)] }),
    });
    apps.push(app);
    app.mount(container);
    await until(() => text() === "true:a");
    await flush();
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("logs a rejected autoStart instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const probe = probeOf();
    failures.start = true;
    await mount(probe, config(), true);
    failures.start = false;
    await flush();
    expect(error).toHaveBeenCalledWith("[virtualtour-vue] autoStart failed:", expect.anything());
    expect(probe.latest.isRunning.value).toBe(false);
  });

  it("does not restart after the tour finished when autoStart stays true", async () => {
    const probe = probeOf();
    await mount(probe, config(), true);
    await until(() => text() === "true:a");
    probe.latest.finish();
    await flush();
    expect(probe.latest.isRunning.value).toBe(false);
  });
});

describe("config", () => {
  it("is read once; a new config object does not rebuild the tour", async () => {
    const probe = probeOf();
    const mounted = await mount(probe, config({ steps: steps("a") }));
    const first = probe.latest.tour;
    mounted.props.config = config({ steps: steps("x", "y") });
    await flush();
    expect(probe.latest.tour).toBe(first);
    expect(first.steps.map((s) => s.id)).toEqual(["a"]);
  });

  it("two providers keep independent tours", async () => {
    const a = probeOf();
    const b = probeOf();
    const A = capture(a);
    const B = capture(b);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => [
        h(TourProvider, { config: config({ steps: steps("a") }) }, { default: () => h(A) }),
        h(TourProvider, { config: config({ steps: steps("b") }) }, { default: () => h(B) }),
      ],
    });
    apps.push(app);
    app.mount(container);
    await nextTick();
    expect(a.latest.tour).not.toBe(b.latest.tour);
    await a.latest.start();
    expect(a.latest.isRunning.value).toBe(true);
    expect(b.latest.isRunning.value).toBe(false);
  });
});

describe("outside a provider", () => {
  it("throws a descriptive error", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = document.createElement("div");
    const Orphan = capture(probeOf());
    const app = createApp(Orphan);
    let caught: unknown = null;
    app.config.errorHandler = (error) => {
      caught = error;
    };
    app.mount(container);
    expect((caught as Error).message).toMatch(/inside a <TourProvider>/);
  });
});
