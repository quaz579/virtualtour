import type { PopoverDOM } from "../engine/popover/popover";
import { DialogPresenter } from "../presenter";
import type { TourStep } from "../step";
import type { Tour } from "../tour";
import type { Presenter, RepositionInfo, StepParts } from "../types";
import type { NormalizedPack } from "./pack";
import { SpritePlayer } from "./player";

/** Which edge of the bubble the avatar sits on. `start` and `end` are inline directions, so they mirror in right-to-left pages. `auto` picks the edge with more room beside the target. */
export type AvatarDock = "start" | "end" | "auto";

/** Avatar settings shared by a whole tour. */
export interface AvatarOptions {
  /** Default `end`, or the pack's `bubble.dock` when it has one. */
  dock?: AvatarDock;
  /** Multiplies the avatar's frame size in CSS pixels. Default 1. */
  scale?: number;
}

/** What a step may set under `extensions.avatar`. */
export interface AvatarStepOptions {
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

function stepOptions(step: TourStep): AvatarStepOptions {
  const raw = step.config.extensions?.["avatar"];
  if (typeof raw !== "object" || raw === null) return {};
  const { dock, hidden } = raw as Record<string, unknown>;
  const out: AvatarStepOptions = {};
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
    this.base.mount(popover, step, parts);
    this.configure(popover, step);
    const dock = this.dockSetting === "auto" ? "end" : this.dockSetting;
    this.write(popover, { side: requestedSide(step), dock });
  }

  afterShow(popover: PopoverDOM, step: TourStep): void {
    this.base.afterShow(popover, step);
  }

  afterReposition(popover: PopoverDOM, step: TourStep, info: RepositionInfo): void {
    this.base.afterReposition(popover, step, info);
    const side: Placement = info.pinned ? "over" : info.side;
    const next: Layout = { side, dock: this.resolveDock(info, side) };
    const previous = this.applied;
    this.write(popover, next);
    if (!previous || (previous.side === next.side && previous.dock === next.dock)) this.refreshes = 0;
    else this.queueRefresh(popover, step);
  }

  update(popover: PopoverDOM, step: TourStep, parts: StepParts): void {
    this.base.update(popover, step, parts);
    this.configure(popover, step);
  }

  beforeLeave(step: TourStep): void {
    this.base.beforeLeave(step);
    this.popover = null;
    this.step = null;
  }

  unmount(): void {
    this.base.unmount();
    this.popover = null;
    this.step = null;
    this.player.dispose();
    this.avatar.remove();
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
