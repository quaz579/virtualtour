import { resolveRole } from "./pack";
import type { AvatarDirection, AvatarRole, NormalizedPack } from "./pack";

const ROLES: readonly string[] = ["rest", "idle", "greet", "point", "think", "celebrate", "exit", "alert"];
const DIRECTIONS: readonly string[] = ["left", "right", "up", "down"];

/** A point in viewport coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** The direction from one point to another along the dominant axis. A tie goes horizontal. */
export function pointDirection(from: Point, to: Point): AvatarDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

/**
 * Turns an animation name, a role name or a role path such as `point.left` into the name of an animation the pack
 * defines. A name the pack defines wins over a role of the same name. Returns `undefined` for anything else.
 * `dir` steers the plain `point` role.
 */
export function resolveAnimation(pack: NormalizedPack, ref: string, dir?: AvatarDirection): string | undefined {
  if (Object.prototype.hasOwnProperty.call(pack.frames, ref)) return ref;
  if (ref.startsWith("point.")) {
    const tail = ref.slice("point.".length);
    if (tail === "any") return resolveRole(pack, "point");
    return DIRECTIONS.includes(tail) ? resolveRole(pack, "point", tail as AvatarDirection) : undefined;
  }
  if (!ROLES.includes(ref)) return undefined;
  const role = ref as AvatarRole;
  return resolveRole(pack, role, role === "point" ? dir : undefined);
}
