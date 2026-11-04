// Tunables carried over 1:1 from the original index.js / utils.js.
// No DOM access anywhere under src/game or src/data: this code must be able to
// run on a server too (authoritative online simulation).

export const WORLD_WIDTH = 1333;
export const WORLD_HEIGHT = 560;

export const GRAVITY = 0.7;
export const MOVE_SPEED = 5;
export const JUMP_VELOCITY = -15;
export const KNOCKBACK = 10;

/** Fixed simulation rate. Rendering runs at the display rate. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const MATCH_SECONDS = 60;
/** Original showed 3, 2, 1, GO! */
export const COUNTDOWN_SECONDS = 3;
export const GO_TICKS = TICK_RATE; // "GO!" banner length

/** Default frames each sprite frame is held (original Character.framesHold). */
export const FRAME_HOLD = 5;
export const DEATH_FRAME_HOLD = 10;

/** Original attack hitbox stayed live for 100ms (~6 ticks). */
export const DEFAULT_ACTIVE_TICKS = 6;
export const DEFAULT_ACTIVE_START = 2;

/** Ticks after a swing ends in which the next combo step may still be started. */
export const COMBO_WINDOW_TICKS = 20;
export const MAX_COMBO = 3;

/** Multipliers per combo step (index 0 = attack1). Characters may override. */
export const DEFAULT_COMBO_STEPS = [
  { damage: 1, knockback: 1 },
  { damage: 1.25, knockback: 1.25 },
  { damage: 1.7, knockback: 1.6 },
] as const;

/** Original: in AI mode the enemy's damage was `player.damage * 2`. */
export const AI_DAMAGE_MULTIPLIER = 2;
