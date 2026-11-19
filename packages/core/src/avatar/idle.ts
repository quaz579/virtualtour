import { prefersReducedMotion } from "../engine/core/env";
import { resolveRole } from "./pack";
import type { NormalizedPack } from "./pack";
import type { SpritePlayer } from "./player";

/** Options for {@link IdleScheduler}. */
export interface IdleSchedulerOptions {
  /** Milliseconds of quiet before an idle animation plays. Default 6000; values below 50 count as 50, and zero or negative values use the default. */
  quietMs?: number;
  /** Read each time the scheduler arms and fires; defaults to the library-wide `prefers-reduced-motion` check. */
  reducedMotion?: () => boolean;
  /** Random source for picking an idle animation; defaults to `Math.random`. */
  random?: () => number;
}

const DEFAULT_QUIET_MS = 6000;
const MIN_QUIET_MS = 50;

/**
 * Plays a random `idle` animation after a quiet period, then returns the avatar to `rest` and waits again. It never
 * arms under reduced motion or when the pack has no `idle` role. Call {@link IdleScheduler.arm} once the avatar is
 * at rest and {@link IdleScheduler.disarm} before anything else moves it.
 */
export class IdleScheduler {
  private readonly player: SpritePlayer;
  private readonly pack: NormalizedPack;
  private readonly quietMs: number;
  private readonly reducedMotion: () => boolean;
  private readonly random: () => number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private token = 0;
  private playing = false;
  private last: string | undefined;

  constructor(player: SpritePlayer, pack: NormalizedPack, opts: IdleSchedulerOptions = {}) {
    this.player = player;
    this.pack = pack;
    const quiet = opts.quietMs;
    this.quietMs = typeof quiet === "number" && Number.isFinite(quiet) && quiet > 0 ? Math.max(quiet, MIN_QUIET_MS) : DEFAULT_QUIET_MS;
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion;
    this.random = opts.random ?? Math.random;
  }

  /** Starts the quiet period, replacing one that is already running. Does nothing under reduced motion. */
  arm(): void {
    this.disarm();
    const idle = this.pack.roles.idle;
    if (idle === undefined || (Array.isArray(idle) && idle.length === 0) || this.reducedMotion()) return;
    const token = this.token;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.fire(token);
    }, this.quietMs);
  }

  /** Cancels the quiet period and, if an idle animation is playing, stops it so the avatar returns to `rest`. */
  disarm(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.token += 1;
    if (this.playing) {
      this.playing = false;
      this.player.stop();
    }
  }

  private fire(token: number): void {
    if (token !== this.token || this.reducedMotion()) return;
    const name = resolveRole(this.pack, "idle", undefined, this.last, this.random);
    this.last = name;
    this.playing = true;
    this.player.play(name, { loop: false }).then(
      () => {
        if (token !== this.token) return;
        this.playing = false;
        this.player.stop();
        this.arm();
      },
      () => {
        if (token !== this.token) return;
        this.playing = false;
        this.arm();
      },
    );
  }
}
