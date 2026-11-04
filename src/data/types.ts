// Data-driven definitions for characters and backgrounds.
// To add content: add a config object to the registry + drop the assets in /public.

export interface AnimDef {
  /** File name relative to the character's `basePath`, e.g. "run.png". Horizontal sprite sheet. */
  src: string;
  frames: number;
  /**
   * Optional left-facing sheet.
   *  - `true`  -> derived name: "run.png" -> "runLeft.png"
   *  - string  -> explicit file name
   *  - absent  -> the right-facing sheet is mirrored at render time
   */
  left?: boolean | string;
  /** Ticks per frame (default FRAME_HOLD). */
  hold?: number;
  /** Attack animations only: ticks (from swing start) when the hitbox turns on / how long it stays on. */
  activeStart?: number;
  activeTicks?: number;
}

export interface CharacterSprites {
  idle: AnimDef;
  run: AnimDef;
  jump: AnimDef;
  hit: AnimDef;
  death: AnimDef;
  /** attack1 is required; attack2/attack3 are optional and fall back to the nearest lower one. */
  attack1: AnimDef;
  attack2?: AnimDef;
  attack3?: AnimDef;
}

export interface CharacterDef {
  id: string;
  name: string;
  /** Health-bar / name colour. */
  color: string;
  /** Public URL folder that contains the sprite sheets, with trailing slash. */
  basePath: string;
  sprites: CharacterSprites;

  /** Draw scale and the offset from the fighter's (x, y) to the sprite's top-left, as in the original. */
  scale: number;
  drawOffset: { x: number; y: number };

  /** Collision body. */
  body: { width: number; height: number };
  /** Base damage per active tick (original 0.25). */
  damage: number;
  attackBox: { width: number; height: number; offsetRight: number; offsetLeft: number };
  /** Optional per-step multipliers (index 0 = attack1). */
  comboSteps?: { damage: number; knockback: number }[];

  sounds: { hit: string; death: string };
}

export interface BackgroundDef {
  id: string;
  name: string;
  /** Public URL. May be an animated GIF/WebP; it is drawn as a layer behind the canvas. */
  src: string;
  thumbnail?: string;
}
