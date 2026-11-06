// Plain-data types shared by the simulation, renderer, input sources and (later) the network layer.
// Everything in MatchState is JSON-serialisable on purpose: it can be sent as a snapshot.

export type Facing = "left" | "right";
export type SlotIndex = 0 | 1;

export type AttackAnim = "attack1" | "attack2" | "attack3";
export type AnimName = "idle" | "run" | "jump" | "hit" | "death" | AttackAnim;

/** One tick of intent from one player. `jump` and `attack` are edge-triggered (pressed this tick). */
export interface InputFrame {
  moveX: -1 | 0 | 1;
  jump: boolean;
  attack: boolean;
}

export const EMPTY_INPUT: InputFrame = Object.freeze({ moveX: 0, jump: false, attack: false });

export interface FighterState {
  slot: SlotIndex;
  characterId: string;
  name: string;
  color: string;

  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: Facing;

  health: number;
  /** Lives left (the current one included) and the starting amount, from the match rules. */
  lives: number;
  maxLives: number;
  /** Ticks until a KO'd fighter with lives left respawns; 0 when not waiting to respawn. */
  respawnTicks: number;
  /** Ticks of damage immunity after a respawn. */
  invulnTicks: number;
  damage: number;
  /** True once the death animation finished. */
  dead: boolean;
  jumps: number;
  canJump: boolean;

  anim: AnimName;
  frame: number;
  animTick: number;

  combo: {
    /** 0 = not in a combo, 1..3 = the step currently swinging or just finished. */
    step: 0 | 1 | 2 | 3;
    swinging: boolean;
    /** Ticks since the current swing started. */
    swingTick: number;
    /** Attack pressed during a swing, to chain on the next free tick. */
    buffered: boolean;
    /** Ticks left to start the next step after a swing. */
    windowLeft: number;
    /** Damage was already announced (sound) for this swing. */
    connected: boolean;
  };
}

export type MatchPhase = "countdown" | "fighting" | "over";

export interface MatchState {
  tick: number;
  phase: MatchPhase;
  /** Ticks left in the countdown, then in the "GO!" banner is `goTicks`. */
  countdownTicks: number;
  goTicks: number;
  timeLeftTicks: number;
  /** null while playing, "tie" or a slot index when over. */
  winner: SlotIndex | "tie" | null;
  /** "ko" = a fighter ran out of lives, "time" = the clock ran out. */
  endReason: "ko" | "time" | null;
  fighters: [FighterState, FighterState];
}

export type GameEvent =
  | { type: "swing"; slot: SlotIndex; step: number }
  | { type: "hit"; attacker: SlotIndex; target: SlotIndex; step: number }
  | { type: "ko"; slot: SlotIndex }
  | { type: "go" };

export interface MatchRules {
  /** Multiplier applied to slot 1's damage (original single-player AI doubled it). */
  slotDamageMultiplier: [number, number];
}
