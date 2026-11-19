import type { PopoverDOM } from "../engine/popover/popover";
import { DialogPresenter } from "../presenter";
import type { TourStep } from "../step";
import type { Tour } from "../tour";
import type { Presenter, PresenterContext, PresenterFactory, RepositionInfo, StepParts } from "../types";
import { AvatarPackError, normalizePack, preloadSheet, validatePack } from "./pack";
import type { AvatarPack, NormalizedPack } from "./pack";
import { SpeakerPresenter } from "./speaker";
import type { AvatarOptions } from "./speaker";

declare const __DEV__: boolean | undefined;

const DEFAULT_LOAD_TIMEOUT_MS = 3000;

type PackInput = AvatarPack | NormalizedPack | Promise<AvatarPack | NormalizedPack>;

function loadTimeout(options: AvatarOptions): number {
  const configured = options.loadTimeoutMs;
  return typeof configured === "number" && Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_LOAD_TIMEOUT_MS;
}

function isNormalized(pack: AvatarPack | NormalizedPack): pack is NormalizedPack {
  return "frames" in pack && "sheetUrl" in pack;
}

class PackSource {
  private pack: NormalizedPack | null = null;
  private failed = false;
  private reported = false;
  private timedOut = false;
  private settled: Promise<void> | null = null;
  private readonly input: PackInput;
  private readonly options: AvatarOptions;

  constructor(input: PackInput, options: AvatarOptions) {
    this.input = input;
    this.options = options;
    Promise.resolve(input).catch(() => undefined);
  }

  private begin(): Promise<void> {
    this.settled ??= Promise.resolve(this.input).then(
      async (value) => {
        try {
          if (isNormalized(value)) {
            this.pack = value;
            return;
          }
          const pack = normalizePack(validatePack(value), document.baseURI);
          await preloadSheet(pack.sheetUrl, { timeoutMs: loadTimeout(this.options) });
          this.pack = pack;
        } catch (error) {
          this.fail(error);
        }
      },
      (error: unknown) => this.fail(error),
    );
    return this.settled;
  }

  get ready(): NormalizedPack | null {
    return this.pack;
  }

  wait(): Promise<void> {
    const settled = this.begin();
    if (this.pack || this.failed || this.timedOut) return Promise.resolve();
    const ms = loadTimeout(this.options);
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.timedOut = true;
        this.report(new AvatarPackError("loadTimeoutMs", `the pack did not load within ${ms} ms; this run uses the dialog presenter`));
        resolve();
      }, ms);
      void settled.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private fail(error: unknown): void {
    this.failed = true;
    this.report(error instanceof AvatarPackError ? error : new AvatarPackError("pack", error instanceof Error ? error.message : String(error)));
  }

  private report(error: AvatarPackError): void {
    if (this.reported) return;
    this.reported = true;
    if (typeof __DEV__ === "undefined" || __DEV__) console.warn("[virtualtour] Avatar pack unavailable; using the dialog presenter.", error);
    try {
      this.options.onError?.(error);
    } catch (thrown) {
      console.error(thrown);
    }
  }
}

class AvatarPresenter implements Presenter {
  layout: "dialog" | "speaker" = "dialog";
  private readonly tour: Tour;
  private readonly context: PresenterContext;
  private readonly source: PackSource;
  private readonly options: AvatarOptions;
  private delegate: Presenter | null = null;
  private disposed = false;

  constructor(tour: Tour, context: PresenterContext, source: PackSource, options: AvatarOptions) {
    this.tour = tour;
    this.context = context;
    this.source = source;
    this.options = options;
  }

  ready(): Promise<void> {
    return this.source.wait().then(() => {
      if (!this.disposed) this.choose();
    });
  }

  mount(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.active().mount(popover, step, parts);
  }

  afterShow(popover: PopoverDOM, step: TourStep): void {
    this.active().afterShow(popover, step);
  }

  afterReposition(popover: PopoverDOM, step: TourStep, info: RepositionInfo): void {
    this.active().afterReposition(popover, step, info);
  }

  update(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.active().update(popover, step, parts);
  }

  beforeLeave(step: TourStep): void {
    this.active().beforeLeave(step);
  }

  onNudge(step: TourStep): void {
    this.active().onNudge?.(step);
  }

  onCompleted(step: TourStep): void {
    this.active().onCompleted?.(step);
  }

  unmount(): void {
    this.disposed = true;
    this.delegate?.unmount();
  }

  private active(): Presenter {
    return this.delegate ?? this.choose();
  }

  private choose(): Presenter {
    if (this.delegate) return this.delegate;
    const pack = this.source.ready;
    const { onError: _onError, loadTimeoutMs: _loadTimeoutMs, ...speaker } = this.options;
    const { namespace, sanitize, fadeMs } = this.context;
    this.delegate = pack
      ? new SpeakerPresenter(this.tour, pack, { ...speaker, namespace, fadeMs, ...(sanitize ? { sanitize } : {}) })
      : new DialogPresenter(this.tour, namespace, sanitize);
    this.layout = pack ? "speaker" : "dialog";
    return this.delegate;
  }
}

/**
 * Builds a presenter factory that shows each step as a speech bubble with an animated character beside it. Pass it
 * as `presenter` in the tour config and load `virtualtour/avatar.css`. The pack may be a promise; each run waits for
 * it up to `loadTimeoutMs`, and falls back to the dialog presenter when it fails or arrives too late, calling
 * `onError` once. A later run uses the pack once it has loaded. Steps choose their animation with
 * `extensions.avatar.animation`; otherwise the first step without a target greets and a step with a target points.
 */
export function withAvatar(pack: PackInput, options: AvatarOptions = {}): PresenterFactory {
  const source = new PackSource(pack, options);
  return (tour, context) => new AvatarPresenter(tour, context, source, options);
}
