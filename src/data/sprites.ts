import type { AnimName, AttackAnim, Facing } from "@/game/types";
import type { AnimDef, CharacterDef } from "./types";

export interface ResolvedSprite {
  anim: AnimDef;
  url: string;
  /** True when no left-facing sheet exists and the right-facing one must be mirrored at draw time. */
  flip: boolean;
}

function withLeftSuffix(src: string): string {
  return src.replace(/(\.[a-z0-9]+)$/i, "Left$1");
}

export function rightUrl(def: CharacterDef, anim: AnimDef): string {
  return def.basePath + anim.src;
}

/** URL of the left-facing sheet, or null if this animation has none. */
export function leftUrl(def: CharacterDef, anim: AnimDef): string | null {
  if (!anim.left) return null;
  return def.basePath + (typeof anim.left === "string" ? anim.left : withLeftSuffix(anim.src));
}

/**
 * Combo step -> animation. Uses attack{step} if the character has it,
 * otherwise the nearest lower attack that exists (attack1 always exists).
 */
export function resolveAttackAnim(def: CharacterDef, step: number): AttackAnim {
  const s = Math.min(Math.max(Math.floor(step), 1), 3);
  if (s >= 3 && def.sprites.attack3) return "attack3";
  if (s >= 2 && def.sprites.attack2) return "attack2";
  return "attack1";
}

export function animDef(def: CharacterDef, name: AnimName): AnimDef {
  return def.sprites[name] as AnimDef;
}

/** Pick the sheet for an animation + facing: dedicated left sheet if present, else the mirrored right one. */
export function resolveSprite(def: CharacterDef, name: AnimName, facing: Facing): ResolvedSprite {
  const anim = animDef(def, name);
  if (facing === "left") {
    const left = leftUrl(def, anim);
    if (left) return { anim, url: left, flip: false };
    return { anim, url: rightUrl(def, anim), flip: true };
  }
  return { anim, url: rightUrl(def, anim), flip: false };
}

/** Every distinct image a character can need (used for preloading). */
export function allSpriteUrls(def: CharacterDef): string[] {
  const urls = new Set<string>();
  for (const anim of Object.values(def.sprites)) {
    if (!anim) continue;
    urls.add(rightUrl(def, anim));
    const l = leftUrl(def, anim);
    if (l) urls.add(l);
  }
  return [...urls];
}
