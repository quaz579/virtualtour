import { prefersReducedMotion } from "../engine/core/env";
import { subscribe } from "../dom/frame";
import { AvatarPackError, resolveRole } from "./pack";
import type { AvatarDirection, AvatarRole, NormalizedPack } from "./pack";

/** Options for {@link SpritePlayer}. */
export interface SpritePlayerOptions {
  /** Read on every `play`; defaults to the library-wide `prefers-reduced-motion` check. */
  reducedMotion?: () => boolean;
  /** Random source for picking idle animations; defaults to `Math.random`. */
  random?: () => number;
}

interface Run {
  name: string;
  loop: boolean;
  startedAt: number;
  total: number;
  ends: number[];
  index: number;
  resolve: () => void;
  unsubscribe: () => void;
  hiddenAt: number | null;
}

const STYLE_PROPS = [
  "width",
  "height",
  "background-image",
  "background-repeat",
  "background-position",
  "background-size",
  "image-rendering",
] as const;

function cssUrl(url: string): string {
  const escaped = url.replace(/[\\']/g, "\\$&").replace(/\n/g, "\\a ").replace(/\r/g, "\\d ").replace(/\f/g, "\\c ");
  return `url('${escaped}')`;
}

/**
 * Plays named animations from a sprite sheet on one element, driven by the shared animation-frame loop.
 * The element is decorative (`aria-hidden`) and can move between parents without resetting the player.
 */
export class SpritePlayer {
  private readonly pack: NormalizedPack;
  private readonly el: HTMLElement;
  private readonly reducedMotion: () => boolean;
  private readonly random: () => number;
  private run: Run | null = null;
  private shownIndex = -1;
  private shownName: string | null = null;
  private lastIdle: string | undefined;
  private disposed = false;

  constructor(pack: NormalizedPack, el: HTMLElement, opts: SpritePlayerOptions = {}) {
    this.pack = pack;
    this.el = el;
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion;
    this.random = opts.random ?? Math.random;
    const { frameWidth, frameHeight, columns, scale = 1, pixelArt } = pack.sheet;
    el.setAttribute("aria-hidden", "true");
    el.style.width = `${frameWidth}px`;
    el.style.height = `${frameHeight}px`;
    el.style.backgroundImage = cssUrl(pack.sheetUrl);
    el.style.backgroundRepeat = "no-repeat";
    if (scale !== 1) {
      if (columns !== undefined) {
        el.style.backgroundSize = `${columns * frameWidth}px auto`;
      } else if (typeof Image !== "undefined") {
        const probe = new Image();
        probe.onload = () => {
          if (!this.disposed) el.style.backgroundSize = `${probe.naturalWidth / scale}px ${probe.naturalHeight / scale}px`;
        };
        probe.src = pack.sheetUrl;
      }
    }
    if (pixelArt) el.style.imageRendering = "pixelated";
    this.show(pack.roles.rest, this.pack.stillOf(pack.roles.rest));
  }

  /** Name of the animation that is running, or `null` when idle, stopped or showing a still. */
  get current(): string | null {
    return this.run ? this.run.name : null;
  }

  /**
   * Plays a named animation. Resolves when a non-looping animation ends, or when another `play`, `stop` or
   * `dispose` interrupts it. `opts.loop` overrides the animation's own `loop` flag; a looping run resolves only
   * on interruption. Under reduced motion it shows the still frame and resolves immediately.
   * Rejects with {@link AvatarPackError} for an animation the pack does not define.
   */
  play(name: string, opts: { loop?: boolean } = {}): Promise<void> {
    const frames = Object.prototype.hasOwnProperty.call(this.pack.frames, name) ? this.pack.frames[name] : undefined;
    if (this.disposed) return Promise.resolve();
    if (!frames || frames.length === 0) {
      return Promise.reject(new AvatarPackError(`animations.${name}`, "is not defined in this pack"));
    }
    this.interrupt();
    if (this.reducedMotion()) {
      this.show(name, this.pack.stillOf(name));
      return Promise.resolve();
    }
    const loop = opts.loop ?? this.pack.animations[name]?.loop ?? false;
    const ends: number[] = [];
    let total = 0;
    for (const frame of frames) {
      total += frame.ms;
      ends.push(total);
    }
    this.show(name, 0);
    return new Promise<void>((resolve) => {
      const startedAt = performance.now();
      const run: Run = {
        name,
        loop,
        startedAt,
        total,
        ends,
        index: 0,
        resolve,
        unsubscribe: () => undefined,
        hiddenAt: typeof document !== "undefined" && document.hidden ? startedAt : null,
      };
      this.run = run;
      const onVisibility = (): void => this.syncVisibility(run);
      const unsubscribeFrame = subscribe((now) => this.tick(run, now));
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
      run.unsubscribe = () => {
        unsubscribeFrame();
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      };
    });
  }

  /**
   * Plays the animation a role resolves to. The same idle animation is not picked twice in a row.
   * @see {@link resolveRole}
   */
  playRole(role: AvatarRole, dir?: AvatarDirection): Promise<void> {
    const name = resolveRole(this.pack, role, dir, role === "idle" ? this.lastIdle : undefined, this.random);
    if (role === "idle") this.lastIdle = name;
    return this.play(name);
  }

  /** Stops any running animation (resolving its promise) and shows the still frame of the `rest` role. */
  stop(): void {
    if (this.disposed) return;
    this.interrupt();
    const rest = this.pack.roles.rest;
    this.show(rest, this.pack.stillOf(rest));
  }

  /**
   * Shows the still frame of an animation without playing it, interrupting any running animation.
   * @throws {AvatarPackError} when the pack does not define `name`.
   */
  still(name: string): void {
    if (this.disposed) return;
    const index = this.pack.stillOf(name);
    this.interrupt();
    this.show(name, index);
  }

  /** Stops, resolves any pending promise, releases the frame subscription and clears the inline styles. */
  dispose(): void {
    if (this.disposed) return;
    this.interrupt();
    this.disposed = true;
    for (const prop of STYLE_PROPS) this.el.style.removeProperty(prop);
    this.el.removeAttribute("aria-hidden");
  }

  private interrupt(): void {
    const run = this.run;
    if (!run) return;
    this.run = null;
    run.unsubscribe();
    run.resolve();
  }

  private syncVisibility(run: Run): void {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      if (run.hiddenAt === null) run.hiddenAt = performance.now();
    } else if (run.hiddenAt !== null) {
      run.startedAt += performance.now() - run.hiddenAt;
      run.hiddenAt = null;
    }
  }

  private tick(run: Run, now: number): void {
    if (this.run !== run) return;
    this.syncVisibility(run);
    const elapsed = Math.max(0, now - run.startedAt);
    if (!run.loop && elapsed >= run.total) {
      this.run = null;
      run.unsubscribe();
      this.show(run.name, this.pack.stillOf(run.name));
      run.resolve();
      return;
    }
    const at = run.loop ? elapsed % run.total : elapsed;
    let index = 0;
    while (index < run.ends.length - 1 && at >= (run.ends[index] ?? 0)) index += 1;
    if (index !== run.index) {
      run.index = index;
      this.show(run.name, index);
    }
  }

  private show(name: string, index: number): void {
    if (name === this.shownName && index === this.shownIndex) return;
    const frame = this.pack.frames[name]?.[index];
    if (!frame) return;
    this.shownName = name;
    this.shownIndex = index;
    this.el.style.backgroundPosition = `${-frame.x}px ${-frame.y}px`;
  }
}
