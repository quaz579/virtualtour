import { Activity, Component, StrictMode, act, useEffect } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { tours } from "virtualtour";
import type { Tour, TourConfig } from "virtualtour";
import { TourProvider, useTour } from "../src/index";
import type { UseTourResult } from "../src/index";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  tours.off();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const steps = (...ids: string[]) => ids.map((id) => ({ id, title: id.toUpperCase(), body: `Body ${id}` }));

function config(extra: Partial<TourConfig> = {}): TourConfig {
  return { animate: false, steps: steps("a", "b", "c"), ...extra };
}

interface Probe {
  latest: UseTourResult;
  renders: number;
}

function Capture({ probe }: { probe: Probe }): ReactNode {
  const value = useTour();
  probe.latest = value;
  probe.renders += 1;
  return <span data-testid="state">{`${value.isRunning}:${value.currentStep?.id ?? "none"}`}</span>;
}

async function mount(ui: ReactNode): Promise<Root> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(ui));
  return root;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(check()).toBe(true);
}

function probeOf(): Probe {
  return { latest: undefined as unknown as UseTourResult, renders: 0 };
}

const text = () => document.querySelector("[data-testid=state]")?.textContent;

describe("useTour values", () => {
  it("track the run through start, forward, backward and finish", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    expect(text()).toBe("false:none");

    await act(async () => probe.latest.start());
    expect(text()).toBe("true:a");
    expect(probe.latest.isRunning).toBe(true);
    expect(probe.latest.currentStep).toBe(probe.latest.tour.steps[0]);

    await act(async () => probe.latest.forward());
    expect(text()).toBe("true:b");
    await act(async () => probe.latest.forward());
    expect(text()).toBe("true:c");
    await act(async () => probe.latest.backward());
    expect(text()).toBe("true:b");

    await act(async () => probe.latest.finish());
    expect(text()).toBe("false:none");
  });

  it("updates when the run ends through exit", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    let accepted: boolean | undefined;
    await act(async () => {
      accepted = await probe.latest.exit();
    });
    expect(accepted).toBe(true);
    expect(text()).toBe("false:none");
  });

  it("updates when the tour is driven directly", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.tour.goTo("c"));
    expect(text()).toBe("true:c");
  });

  it("keeps method identity and the tour stable across renders", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    const first = probe.latest;
    await act(async () => first.start());
    await act(async () => first.forward());
    const later = probe.latest;
    expect(later).not.toBe(first);
    expect(later.tour).toBe(first.tour);
    expect(later.start).toBe(first.start);
    expect(later.forward).toBe(first.forward);
    expect(later.exit).toBe(first.exit);
    expect(later.finish).toBe(first.finish);
  });

  it("does not rerender consumers when nothing observable changed", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    const before = probe.renders;
    await act(async () => probe.latest.start());
    expect(probe.renders).toBe(before);
  });
});

describe("steps dropped mid-tour", () => {
  async function started(probe: Probe, extra: Partial<TourConfig> = {}): Promise<void> {
    await mount(
      <TourProvider config={config(extra)}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    await act(async () => probe.latest.forward());
    expect(text()).toBe("true:b");
  }

  it("moves currentStep to the step that follows the dropped one", async () => {
    const probe = probeOf();
    await started(probe);
    await act(async () => probe.latest.tour.dropStep("b"));
    await until(() => text() === "true:c");
    expect(probe.latest.currentStep).toBe(probe.latest.tour.steps[1]);
  });

  it("stops reporting the dropped step while the next step waits for its target", async () => {
    const probe = probeOf();
    await started(probe, {
      steps: [
        { id: "a", title: "A", body: "a" },
        { id: "b", title: "B", body: "b" },
        { id: "c", title: "C", body: "c", target: "#never-there", waitFor: 400 },
      ],
    });
    const dropped = probe.latest.currentStep;
    await act(async () => {
      probe.latest.tour.dropStep("b");
    });
    expect(probe.latest.currentStep).not.toBe(dropped);
    await until(() => text() === "true:c");
  });

  it("reports the run ended when the last step on screen is dropped", async () => {
    const probe = probeOf();
    await started(probe, { steps: steps("a", "b") });
    await act(async () => probe.latest.tour.dropStep("b"));
    await until(() => text() === "false:none");
  });

  it("keeps currentStep when another step is dropped", async () => {
    const probe = probeOf();
    await started(probe);
    const before = probe.latest.currentStep;
    await act(async () => probe.latest.tour.dropStep("a"));
    expect(probe.latest.currentStep).toBe(before);
    expect(text()).toBe("true:b");
  });

  it("follows the step after a drop and a later forward", async () => {
    const probe = probeOf();
    await started(probe, { steps: steps("a", "b", "c", "d") });
    await act(async () => probe.latest.tour.dropStep("b"));
    await until(() => text() === "true:c");
    await act(async () => probe.latest.tour.dropStep("c"));
    await until(() => text() === "true:d");
  });

  it("removes its step listener when the provider unmounts", async () => {
    const probe = probeOf();
    const root = await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    const step = probe.latest.currentStep!;
    const added: Array<() => void> = [];
    const original = step.on.bind(step) as (event: string, fn: never) => () => void;
    const on = vi.spyOn(step, "on").mockImplementation(((event: string, fn: never) => {
      const off = original(event, fn);
      const wrapped = vi.fn(off);
      added.push(wrapped);
      return wrapped;
    }) as never);
    await act(async () => probe.latest.forward());
    await act(async () => probe.latest.backward());
    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(on).toHaveBeenCalled();
    expect(added.length).toBeGreaterThan(0);
    for (const off of added) expect(off).toHaveBeenCalled();
  });
});

describe("unmount", () => {
  it("exits a running tour without asking the exit prompt", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const probe = probeOf();
    const root = await mount(
      <TourProvider config={config({ exitPrompt: "Leave the tour?" })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    const tour: Tour = probe.latest.tour;
    const reasons: string[] = [];
    tour.on("exited", (p) => reasons.push(p.reason));
    expect(tour.isRunning()).toBe(true);

    await act(async () => root.unmount());
    roots.length = 0;
    await flush();

    expect(tour.isRunning()).toBe(false);
    expect(reasons).toEqual(["api"]);
    expect(confirm).not.toHaveBeenCalled();
    expect(document.querySelector(".vt-popover")).toBeNull();
  });

  it("exits without calling a function exit prompt", async () => {
    const prompt = vi.fn(async () => false);
    const probe = probeOf();
    const root = await mount(
      <TourProvider config={config({ exitPrompt: prompt })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    const tour = probe.latest.tour;
    await act(async () => root.unmount());
    roots.length = 0;
    await flush();
    expect(tour.isRunning()).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("still honors the exit prompt while mounted", async () => {
    const prompt = vi.fn(async () => false);
    const probe = probeOf();
    await mount(
      <TourProvider config={config({ exitPrompt: prompt })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    let accepted: boolean | undefined;
    await act(async () => {
      accepted = await probe.latest.exit();
    });
    expect(accepted).toBe(false);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(probe.latest.tour.isRunning()).toBe(true);

    prompt.mockResolvedValue(true);
    await act(async () => {
      accepted = await probe.latest.exit();
    });
    expect(accepted).toBe(true);
    expect(probe.latest.tour.isRunning()).toBe(false);
  });

  it("honors a string exit prompt while mounted", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const probe = probeOf();
    await mount(
      <TourProvider config={config({ exitPrompt: "Sure?" })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    await act(async () => {
      expect(await probe.latest.exit()).toBe(false);
    });
    expect(confirm).toHaveBeenCalledWith("Sure?");
    expect(probe.latest.tour.isRunning()).toBe(true);
  });

  it("ends the run when the provider unmounts while an exit prompt is still open", async () => {
    let answer: (value: boolean) => void = () => {};
    const prompt = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    const probe = probeOf();
    const root = await mount(
      <TourProvider config={config({ exitPrompt: prompt })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    const tour = probe.latest.tour;
    void tour.exit();
    await flush();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(tour.isRunning()).toBe(true);

    await act(async () => root.unmount());
    roots.length = 0;
    await flush();
    expect(tour.isRunning()).toBe(false);
    answer(false);
  });

  it("honors the exit prompt again after the provider was hidden and shown", async () => {
    const prompt = vi.fn(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20)));
    const probe = probeOf();
    const ui = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <TourProvider config={config({ exitPrompt: prompt })}>
          <Capture probe={probe} />
        </TourProvider>
      </Activity>
    );
    const root = await mount(ui("visible"));
    await act(async () => root.render(ui("hidden")));
    await flush();
    await act(async () => root.render(ui("visible")));
    await flush();
    await act(async () => probe.latest.start());
    let accepted: boolean | undefined;
    await act(async () => {
      accepted = await probe.latest.exit();
    });
    expect(accepted).toBe(false);
    expect(prompt).toHaveBeenCalledTimes(1);
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
    const root = await mount(
      <TourProvider config={config({ id: "late", progress: { store } as never })} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    );
    const tour = probe.latest.tour;
    expect(tour.isRunning()).toBe(false);
    await act(async () => root.unmount());
    roots.length = 0;
    await flush();
    release();
    await flush();
    await flush();
    expect(tour.isRunning()).toBe(false);
  });
});

describe("autoStart", () => {
  it("starts the tour once after mount", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await until(() => text() === "true:a");
  });

  it("does not start when autoStart is off", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await flush();
    expect(probe.latest.isRunning).toBe(false);
  });

  it("starts once under strict mode and keeps one run alive", async () => {
    const probe = probeOf();
    let started = 0;
    let exited = 0;
    let created = 0;
    function Spy(): ReactNode {
      const { tour } = useTour();
      useEffect(() => {
        created += 1;
        const offStart = tour.on("started", () => (started += 1));
        const offExit = tour.on("exited", () => (exited += 1));
        return () => {
          offStart();
          offExit();
        };
      }, [tour]);
      return null;
    }
    await mount(
      <StrictMode>
        <TourProvider config={config()} autoStart>
          <Spy />
          <Capture probe={probe} />
        </TourProvider>
      </StrictMode>,
    );
    await until(() => text() === "true:a");
    await flush();
    expect(created).toBeGreaterThanOrEqual(2);
    expect(started).toBe(1);
    expect(exited).toBe(0);
    expect(probe.latest.tour.isRunning()).toBe(true);
    expect(text()).toBe("true:a");
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("uses one tour instance under strict mode", async () => {
    const seen = new Set<Tour>();
    function Collect(): ReactNode {
      seen.add(useTour().tour);
      return null;
    }
    await mount(
      <StrictMode>
        <TourProvider config={config()}>
          <Collect />
        </TourProvider>
      </StrictMode>,
    );
    await flush();
    expect(seen.size).toBe(1);
  });

  it("exits a strict-mode run on real unmount", async () => {
    const probe = probeOf();
    const root = await mount(
      <StrictMode>
        <TourProvider config={config()} autoStart>
          <Capture probe={probe} />
        </TourProvider>
      </StrictMode>,
    );
    await until(() => text() === "true:a");
    const tour = probe.latest.tour;
    expect(tour.isRunning()).toBe(true);
    await act(async () => root.unmount());
    roots.length = 0;
    await flush();
    expect(tour.isRunning()).toBe(false);
  });

  it("keeps a tour started after a strict-mode remount alive", async () => {
    const probe = probeOf();
    await mount(
      <StrictMode>
        <TourProvider config={config()}>
          <Capture probe={probe} />
        </TourProvider>
      </StrictMode>,
    );
    await flush();
    await act(async () => probe.latest.start());
    await flush();
    await flush();
    expect(probe.latest.tour.isRunning()).toBe(true);
    expect(text()).toBe("true:a");
  });

  it("does not restart after the tour finished when autoStart stays true", async () => {
    const probe = probeOf();
    await mount(
      <TourProvider config={config()} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await flush();
    await act(async () => probe.latest.finish());
    await flush();
    expect(probe.latest.isRunning).toBe(false);
  });

  it("does not stop a running tour when autoStart flips to false", async () => {
    const probe = probeOf();
    const root = await mount(
      <TourProvider config={config()} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await flush();
    await act(async () => root.render(
      <TourProvider config={config()} autoStart={false}>
        <Capture probe={probe} />
      </TourProvider>,
    ));
    await flush();
    expect(probe.latest.isRunning).toBe(true);
  });
});

describe("config", () => {
  it("is read once; a new config object does not rebuild the tour", async () => {
    const probe = probeOf();
    const root = await mount(
      <TourProvider config={config({ steps: steps("a") })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    const first = probe.latest.tour;
    await act(async () => root.render(
      <TourProvider config={config({ steps: steps("x", "y") })}>
        <Capture probe={probe} />
      </TourProvider>,
    ));
    expect(probe.latest.tour).toBe(first);
    expect(first.steps.map((s) => s.id)).toEqual(["a"]);
  });

  it("a new key builds a new tour and ends the old run", async () => {
    const probe = probeOf();
    const root = await mount(
      <TourProvider key="one" config={config({ steps: steps("a") })}>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await act(async () => probe.latest.start());
    const first = probe.latest.tour;
    await act(async () => root.render(
      <TourProvider key="two" config={config({ steps: steps("x", "y") })}>
        <Capture probe={probe} />
      </TourProvider>,
    ));
    await flush();
    expect(probe.latest.tour).not.toBe(first);
    expect(probe.latest.tour.steps.map((s) => s.id)).toEqual(["x", "y"]);
    expect(first.isRunning()).toBe(false);
    expect(probe.latest.isRunning).toBe(false);
  });

  it("a new key with autoStart ends the old run and starts the new one", async () => {
    const probe = probeOf();
    const root = await mount(
      <TourProvider key="one" config={config({ steps: steps("a") })} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    );
    await until(() => text() === "true:a");
    const first = probe.latest.tour;
    await act(async () => root.render(
      <TourProvider key="two" config={config({ steps: steps("x", "y") })} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    ));
    await until(() => text() === "true:x");
    expect(first.isRunning()).toBe(false);
    expect(document.querySelectorAll(".vt-popover")).toHaveLength(1);
  });

  it("two providers keep independent tours", async () => {
    const a = probeOf();
    const b = probeOf();
    await mount(
      <>
        <TourProvider config={config({ steps: steps("a") })}>
          <Capture probe={a} />
        </TourProvider>
        <TourProvider config={config({ steps: steps("b") })}>
          <Capture probe={b} />
        </TourProvider>
      </>,
    );
    expect(a.latest.tour).not.toBe(b.latest.tour);
  });
});

describe("outside a provider", () => {
  it("throws a descriptive error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown = null;
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      override componentDidCatch(error: unknown) {
        caught = error;
      }
      override render() {
        return this.state.failed ? null : this.props.children;
      }
    }
    await mount(
      <Boundary>
        <Capture probe={probeOf()} />
      </Boundary>,
    );
    expect((caught as Error).message).toMatch(/inside a <TourProvider>/);
  });
});

describe("server rendering", () => {
  it("renders children without a document or running a tour", () => {
    const probe = probeOf();
    const html = renderToString(
      <TourProvider config={config()} autoStart>
        <Capture probe={probe} />
      </TourProvider>,
    );
    expect(html).toContain("false:none");
    expect(probe.latest.tour.isRunning()).toBe(false);
  });

  it("renders under strict mode", () => {
    const html = renderToString(
      <StrictMode>
        <TourProvider config={config()}>
          <Capture probe={probeOf()} />
        </TourProvider>
      </StrictMode>,
    );
    expect(html).toContain("false:none");
  });
});
