import type { PopoverDOM } from "../engine/popover/popover";
import { DialogPresenter } from "../presenter";
import type { TourStep } from "../step";
import type { Tour } from "../tour";
import type { Presenter, RepositionInfo, StepParts } from "../types";
import { prefersReducedMotion } from "../engine/core/env";
import type { AvatarDirection, AvatarPackError, NormalizedPack } from "./pack";
import { resolveRole } from "./pack";
import { SpritePlayer } from "./player";
import { pointDirection, resolveAnimation } from "./select";

declare const __DEV__: boolean | undefined;

/** Which edge of the bubble the avatar sits on. `start` and `end` are inline directions, so they mirror in right-to-left pages. `auto` picks the edge with more room beside the target. */
export type AvatarDock = "start" | "end" | "auto";

/** Avatar settings shared by a whole tour. */
export interface AvatarOptions {
  /** Default `end`, or the pack's `bubble.dock` when it has one. */
  dock?: AvatarDock;
  /** Multiplies the avatar's frame size in CSS pixels. Default 1. */
  scale?: number;
  /** Animation name or role for a step that has no target and is not the first step. Default `rest`. */
  defaultAnimation?: string;
  /** Read by `withAvatar`: how long a run waits for the pack before it starts in dialog mode. Default 3000. */
  loadTimeoutMs?: number;
  /** Read by `withAvatar`: called once when the pack fails to load or arrives too late. */
  onError?: (error: AvatarPackError) => void;
}

/** What a step may set under `extensions.avatar`. */
export interface AvatarStepOptions {
  /** An animation name, a role (`greet`, `think`) or a role path (`point.left`). It wins over the automatic choice. */
  animation?: string;
  dock?: AvatarDock;
  /** Leave the avatar out of this step. */
  hidden?: boolean;
}

/** Options for {@link SpeakerPresenter}. */
export interface SpeakerPresenterOptions extends AvatarOptions {
  /** The tour's `namespace`. Default `vt`. */
  namespace?: string;
  /** The tour's `sanitize` hook, applied to custom footer buttons. */
  sanitize?: (html: string) => string;
  /** Milliseconds the engine's entrance fade takes. Step animations start after it. Default 0. */
  fadeMs?: number;
}

type Placement = "top" | "bottom" | "left" | "right" | "over";
type Edge = "start" | "end";

interface Layout {
  side: Placement;
  dock: Edge;
}

const SPEAKER_SIDE_ATTR = "data-vt-side";
const DOCK_ATTR = "data-vt-dock";
const NO_AVATAR_CLASS = "vt-speaker--no-avatar";
const GAP_VARIABLE = "--vt-avatar-gap";
const REFRESH_BUDGET = 2;
const SIDES: readonly string[] = ["top", "bottom", "left", "right"];
const DOCKS: readonly string[] = ["start", "end", "auto"];
const WAITING_CLASS = "vt-waiting";

function stepOptions(step: TourStep): AvatarStepOptions {
  const raw = step.config.extensions?.["avatar"];
  if (typeof raw !== "object" || raw === null) return {};
  const { dock, hidden, animation } = raw as Record<string, unknown>;
  const out: AvatarStepOptions = {};
  if (typeof animation === "string" && animation !== "") out.animation = animation;
  if (typeof dock === "string" && DOCKS.includes(dock)) out.dock = dock as AvatarDock;
  if (hidden === true) out.hidden = true;
  return out;
}

function requestedSide(step: TourStep): Placement {
  const placement = step.config.placement;
  if (placement === "auto") return "bottom";
  if (typeof placement === "object" && SIDES.includes(placement.side)) return placement.side as Placement;
  if (typeof placement === "object" && placement.side === "auto") return "bottom";
  return "over";
}

/**
 * A presenter that draws each step as a speech bubble with an avatar beside it. It keeps the dialog presenter's
 * body, buttons, focus and dialog semantics, moves one decorative avatar element into each step's popover, and
 * docks the avatar on the side of the bubble that faces away from the target. Load `virtualtour/avatar.css` after
 * `base.css`.
 */
export class SpeakerPresenter implements Presenter {
  readonly layout = "speaker" as const;
  /** The decorative `vt-avatar` element. It is moved into each step's popover and keeps its animation state. */
  readonly avatar: HTMLElement;
  /** Plays the pack's animations on {@link SpeakerPresenter.avatar}. */
  readonly player: SpritePlayer;
  private readonly tour: Tour;
  private readonly pack: NormalizedPack;
  private readonly options: SpeakerPresenterOptions;
  private readonly base: DialogPresenter;
  private readonly namespaceSideAttr: string;
  private readonly scale: number;
  private popover: PopoverDOM | null = null;
  private step: TourStep | null = null;
  private dockSetting: AvatarDock = "end";
  private hidden = false;
  private applied: Layout | null = null;
  private refreshes = 0;
  private refreshQueued = false;
  private info: RepositionInfo | null = null;
  private shown = false;
  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver | null = null;
  private waiting = false;
  private pointing: AvatarDirection | null = null;
  private deferred: TourStep | null = null;

  constructor(tour: Tour, pack: NormalizedPack, options: SpeakerPresenterOptions = {}) {
    this.tour = tour;
    this.pack = pack;
    this.options = options;
    this.base = new DialogPresenter(tour, options.namespace ?? "vt", options.sanitize);
    this.namespaceSideAttr = `data-${options.namespace ?? "vt"}-side`;
    const scale = options.scale;
    this.scale = typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.avatar = document.createElement("div");
    this.avatar.className = "vt-avatar";
    this.player = new SpritePlayer(pack, this.avatar);
    if (this.scale !== 1) {
      this.avatar.style.transform = `scale(${this.scale})`;
      this.avatar.style.transformOrigin = "0 0";
    }
  }

  mount(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.popover = popover;
    this.step = step;
    this.refreshes = 0;
    this.refreshQueued = false;
    this.info = null;
    this.shown = false;
    this.deferred = null;
    this.base.mount(popover, step, parts);
    this.configure(popover, step);
    this.watchWaiting(popover);
    const dock = this.dockSetting === "auto" ? "end" : this.dockSetting;
    this.write(popover, { side: requestedSide(step), dock });
  }

  afterShow(popover: PopoverDOM, step: TourStep): void {
    this.base.afterShow(popover, step);
    this.shown = true;
    if (this.hidden) return;
    if (this.waiting) {
      this.deferred = step;
      this.start(this.resolveRoleName("think"), true);
      return;
    }
    const delay = prefersReducedMotion() ? 0 : Math.max(0, this.options.fadeMs ?? 0);
    const seq = this.interrupt();
    if (delay === 0) {
      this.perform(step);
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.seq === seq && this.step === step) this.perform(step);
    }, delay);
  }

  onNudge(_step: TourStep): void {
    this.react("alert");
  }

  onCompleted(_step: TourStep): void {
    this.react("celebrate");
  }

  afterReposition(popover: PopoverDOM, step: TourStep, info: RepositionInfo): void {
    this.base.afterReposition(popover, step, info);
    const side: Placement = info.pinned ? "over" : info.side;
    this.info = info;
    const next: Layout = { side, dock: this.resolveDock(info, side) };
    const previous = this.applied;
    this.write(popover, next);
    if (!previous || (previous.side === next.side && previous.dock === next.dock)) this.refreshes = 0;
    else this.queueRefresh(popover, step);
    this.repoint();
  }

  update(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.base.update(popover, step, parts);
    this.configure(popover, step);
  }

  beforeLeave(step: TourStep): void {
    this.base.beforeLeave(step);
    this.quiet();
    this.shown = false;
    this.player.stop();
    this.popover = null;
    this.step = null;
  }

  unmount(): void {
    this.base.unmount();
    this.quiet();
    this.shown = false;
    this.popover = null;
    this.step = null;
    this.player.dispose();
    this.avatar.remove();
  }

  private quiet(): void {
    this.interrupt();
    this.observer?.disconnect();
    this.observer = null;
    this.waiting = false;
    this.pointing = null;
    this.deferred = null;
  }

  private interrupt(): number {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.seq += 1;
    return this.seq;
  }

  private watchWaiting(popover: PopoverDOM): void {
    this.observer?.disconnect();
    this.observer = null;
    this.waiting = false;
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      const waiting = popover.wrapper.classList.contains(WAITING_CLASS);
      if (waiting === this.waiting) return;
      this.waiting = waiting;
      if (this.hidden || !this.shown) return;
      const pending = this.timer !== null ? this.step : null;
      this.interrupt();
      if (waiting) {
        this.deferred = pending ?? this.deferred;
        this.pointing = null;
        this.start(this.resolveRoleName("think"), true);
        return;
      }
      this.player.stop();
      const resume = this.deferred;
      this.deferred = null;
      if (resume && resume === this.step) this.perform(resume);
    });
    observer.observe(popover.wrapper, { attributes: true, attributeFilter: ["class"] });
    this.observer = observer;
  }

  private resolveRoleName(ref: string, dir?: AvatarDirection): string {
    return resolveAnimation(this.pack, ref, dir) ?? this.pack.roles.rest;
  }

  private react(role: "alert" | "celebrate"): void {
    if (this.hidden || !this.shown) return;
    if (this.timer !== null) this.deferred = this.step;
    const seq = this.interrupt();
    this.pointing = null;
    this.start(this.resolveRoleName(role), false, () => {
      if (this.seq !== seq) return;
      if (this.waiting) {
        this.start(this.resolveRoleName("think"), true);
        return;
      }
      this.player.stop();
      const resume = this.deferred;
      this.deferred = null;
      if (resume && resume === this.step) this.perform(resume);
    });
  }

  private start(name: string, loop: boolean, done?: () => void): void {
    const run = loop ? this.player.play(name, { loop: true }) : this.player.play(name);
    run.then(done, (error: unknown) => {
      if (typeof __DEV__ === "undefined" || __DEV__) console.warn(`[virtualtour] Avatar animation "${name}" failed.`, error);
    });
  }

  private direction(): AvatarDirection | null {
    const info = this.info;
    if (!info?.targetRect) return null;
    const own = this.avatar.getBoundingClientRect();
    const from = own.width > 0 || own.height > 0 ? own : info.wrapperRect;
    const target = info.targetRect;
    return pointDirection(
      { x: from.left + from.width / 2, y: from.top + from.height / 2 },
      { x: target.left + target.width / 2, y: target.top + target.height / 2 },
    );
  }

  private perform(step: TourStep): void {
    const explicit = stepOptions(step).animation;
    const dir = this.direction();
    this.pointing = null;
    let name: string | undefined;
    if (explicit !== undefined) {
      name = resolveAnimation(this.pack, explicit, dir ?? undefined);
      if (name === undefined && (typeof __DEV__ === "undefined" || __DEV__)) {
        console.warn(`[virtualtour] Step "${step.id}" asks for avatar animation "${explicit}", which is neither a pack animation nor a role.`);
      }
    }
    if (name === undefined) {
      if (dir === null) {
        const first = this.tour.steps.indexOf(step) === 0;
        name = first ? resolveRole(this.pack, "greet") : this.defaultName();
      } else {
        name = resolveRole(this.pack, "point", dir);
        this.pointing = dir;
      }
    }
    this.start(name, false);
  }

  private defaultName(): string {
    const configured = this.options.defaultAnimation;
    return (configured === undefined ? undefined : resolveAnimation(this.pack, configured)) ?? this.pack.roles.rest;
  }

  private repoint(): void {
    if (this.pointing === null || !this.shown || this.hidden || this.timer !== null) return;
    const dir = this.direction();
    if (dir === null || dir === this.pointing) return;
    this.pointing = dir;
    this.interrupt();
    this.start(resolveRole(this.pack, "point", dir), false);
  }

  private configure(popover: PopoverDOM, step: TourStep): void {
    const options = stepOptions(step);
    this.hidden = options.hidden === true;
    this.dockSetting = options.dock ?? this.options.dock ?? this.pack.bubble?.dock ?? "end";
    const wrapper = popover.wrapper;
    wrapper.classList.toggle(NO_AVATAR_CLASS, this.hidden);
    const gap = this.pack.bubble?.gap;
    if (gap !== undefined) wrapper.style.setProperty(GAP_VARIABLE, `${gap}px`);
    const slot = popover.avatarSlot;
    if (!slot) return;
    slot.style.width = `${this.pack.sheet.frameWidth * this.scale}px`;
    slot.style.height = `${this.pack.sheet.frameHeight * this.scale}px`;
    if (this.hidden) this.avatar.remove();
    else if (this.avatar.parentElement !== slot) slot.appendChild(this.avatar);
  }

  private resolveDock(info: RepositionInfo, side: Placement): Edge {
    if (this.dockSetting !== "auto") return this.dockSetting;
    if (this.hidden || side === "over" || !info.targetRect) return "end";
    if (side === "top" || side === "bottom") {
      const room = { left: info.targetRect.left, right: window.innerWidth - info.targetRect.right };
      const edge = room.right >= room.left ? "right" : "left";
      return edge === (info.rtl ? "left" : "right") ? "end" : "start";
    }
    const needed = info.wrapperRect.height - info.bubbleRect.height;
    const centre = info.targetRect.top + info.targetRect.height / 2;
    const half = info.bubbleRect.height / 2;
    if (centre + half + needed <= window.innerHeight) return "end";
    return centre - half - needed >= 0 ? "start" : "end";
  }

  private write(popover: PopoverDOM, layout: Layout): void {
    const wrapper = popover.wrapper;
    wrapper.setAttribute(DOCK_ATTR, layout.dock);
    wrapper.setAttribute(SPEAKER_SIDE_ATTR, layout.side);
    wrapper.setAttribute(this.namespaceSideAttr, layout.side);
    this.applied = layout;
  }

  private queueRefresh(popover: PopoverDOM, step: TourStep): void {
    if (this.refreshQueued || this.refreshes >= REFRESH_BUDGET) return;
    this.refreshQueued = true;
    this.refreshes += 1;
    queueMicrotask(() => {
      this.refreshQueued = false;
      if (this.popover !== popover || this.step !== step || !popover.wrapper.isConnected) return;
      this.tour.refresh();
    });
  }
}
