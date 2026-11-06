// Deterministic fixed-step simulation. Pure data in, pure data out; no DOM, no timers, no Math.random.
// This is the part an online server (or a rollback client) would run unchanged.

import { animDef, resolveAttackAnim } from "@/data/sprites";
import { getCharacter } from "@/data/characters";
import type { CharacterDef } from "@/data/types";
import {
  COMBO_WINDOW_TICKS,
  COUNTDOWN_SECONDS,
  DEATH_FRAME_HOLD,
  DEFAULT_ACTIVE_START,
  DEFAULT_ACTIVE_TICKS,
  DEFAULT_COMBO_STEPS,
  FRAME_HOLD,
  GO_TICKS,
  GRAVITY,
  JUMP_VELOCITY,
  KNOCKBACK,
  INVULN_TICKS,
  MAX_COMBO,
  MOVE_SPEED,
  RESPAWN_TICKS,
  TICK_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { DEFAULT_RULES, durationTicks, type GameRules } from "./rules";
import {
  EMPTY_INPUT,
  type AnimName,
  type FighterState,
  type GameEvent,
  type InputFrame,
  type MatchRules,
  type MatchState,
  type SlotIndex,
} from "./types";

export interface SlotSetup {
  characterId: string;
  name: string;
}

export function createFighter(slot: SlotIndex, setup: SlotSetup, lives: number = DEFAULT_RULES.lives): FighterState {
  const def = getCharacter(setup.characterId);
  return {
    slot,
    characterId: def.id,
    name: setup.name,
    color: def.color,
    // Original: P1 at x=0, P2 at x=canvas.width (clamped by the wall check on the first tick).
    x: slot === 0 ? 0 : WORLD_WIDTH - def.body.width,
    y: 0,
    vx: 0,
    vy: 0,
    width: def.body.width,
    height: def.body.height,
    facing: slot === 0 ? "right" : "left",
    health: 100,
    lives,
    maxLives: lives,
    respawnTicks: 0,
    invulnTicks: 0,
    damage: def.damage,
    dead: false,
    jumps: 0,
    canJump: false,
    anim: "idle",
    frame: 0,
    animTick: 0,
    combo: { step: 0, swinging: false, swingTick: 0, buffered: false, windowLeft: 0, connected: false },
  };
}

export function createMatch(slots: [SlotSetup, SlotSetup], rules: GameRules = DEFAULT_RULES): MatchState {
  return {
    tick: 0,
    phase: "countdown",
    countdownTicks: COUNTDOWN_SECONDS * TICK_RATE,
    goTicks: 0,
    timeLeftTicks: durationTicks(rules),
    winner: null,
    endReason: null,
    fighters: [createFighter(0, slots[0], rules.lives), createFighter(1, slots[1], rules.lives)],
  };
}

/** Put a fighter back at its spawn point with full health (used after losing a life). */
function respawn(f: FighterState) {
  const fresh = createFighter(f.slot, { characterId: f.characterId, name: f.name }, f.lives);
  Object.assign(f, fresh, { maxLives: f.maxLives, invulnTicks: INVULN_TICKS });
}

/** More lives wins, then more health; otherwise a tie. */
function decideWinner(p0: FighterState, p1: FighterState): 0 | 1 | "tie" {
  if (p0.lives !== p1.lives) return p0.lives > p1.lives ? 0 : 1;
  if (p0.health !== p1.health) return p0.health > p1.health ? 0 : 1;
  return "tie";
}

/**
 * World-space attack box. `y` is the TOP of a fighter (see physics: `y + height` is the feet), so the
 * box is centred vertically on the torso. (It used to start at the feet, i.e. below the ground.)
 */
export function attackBoxOf(f: FighterState, def: CharacterDef) {
  const offset = f.facing === "left" ? def.attackBox.offsetLeft : def.attackBox.offsetRight;
  return {
    x: f.x + offset,
    y: f.y + (f.height - def.attackBox.height) / 2,
    width: def.attackBox.width,
    height: def.attackBox.height,
  };
}

/** True AABB overlap between the attacker's box and the target's body (hurtbox). Symmetric for both sides. */
export function attackConnects(attacker: FighterState, target: FighterState): boolean {
  const box = attackBoxOf(attacker, getCharacter(attacker.characterId));
  return (
    box.x < target.x + target.width &&
    box.x + box.width > target.x &&
    box.y < target.y + target.height &&
    box.y + box.height > target.y
  );
}

export function isGrounded(f: FighterState, margin = 0): boolean {
  return f.y + f.height + f.vy >= WORLD_HEIGHT - margin;
}

function comboMultipliers(def: CharacterDef, step: number) {
  const steps = def.comboSteps ?? DEFAULT_COMBO_STEPS;
  return steps[Math.min(step, steps.length) - 1] ?? steps[0];
}

function setAnim(f: FighterState, name: AnimName) {
  if (f.anim === name) return;
  f.anim = name;
  f.frame = 0;
  f.animTick = 0;
}

/** Locomotion/hit requests are ignored while a swing, a hit reaction or death is playing. */
function requestAnim(f: FighterState, name: AnimName, def: CharacterDef) {
  if (f.anim === "death" || f.combo.swinging) return;
  if (f.anim === "hit" && f.frame < animDef(def, "hit").frames - 1 && name !== "hit") return;
  setAnim(f, name);
}

function startSwing(f: FighterState, step: 1 | 2 | 3, def: CharacterDef, events: GameEvent[]) {
  f.combo.step = step;
  f.combo.swinging = true;
  f.combo.swingTick = 0;
  f.combo.buffered = false;
  f.combo.windowLeft = 0;
  f.combo.connected = false;
  // Attacking takes priority over a hit reaction (the original let you swing while flinching).
  f.anim = resolveAttackAnim(def, step);
  f.frame = 0;
  f.animTick = 0;
  events.push({ type: "swing", slot: f.slot, step });
}

function handleAttackInput(f: FighterState, def: CharacterDef, events: GameEvent[]) {
  const c = f.combo;
  if (c.swinging) {
    if (c.step < MAX_COMBO) c.buffered = true;
  } else if (c.step > 0 && c.step < MAX_COMBO && c.windowLeft > 0) {
    startSwing(f, (c.step + 1) as 2 | 3, def, events);
  } else {
    startSwing(f, 1, def, events);
  }
}

function hitboxActive(f: FighterState, def: CharacterDef): boolean {
  if (!f.combo.swinging) return false;
  const a = animDef(def, f.anim);
  const start = a.activeStart ?? DEFAULT_ACTIVE_START;
  const len = a.activeTicks ?? DEFAULT_ACTIVE_TICKS;
  return f.combo.swingTick >= start && f.combo.swingTick < start + len;
}

function applyHit(
  attacker: FighterState,
  target: FighterState,
  rules: MatchRules,
  events: GameEvent[],
) {
  const aDef = getCharacter(attacker.characterId);
  const tDef = getCharacter(target.characterId);
  const mult = comboMultipliers(aDef, attacker.combo.step);
  const kb = KNOCKBACK * mult.knockback;

  target.vx = attacker.facing === "left" ? -kb : kb;
  target.vy = target.y + target.height <= WORLD_HEIGHT / 2 ? kb : -kb;
  target.health = Math.max(0, target.health - attacker.damage * mult.damage * rules.slotDamageMultiplier[attacker.slot]);

  // A hit breaks a combo that is waiting for its next step (a swing in progress is not interrupted).
  if (!target.combo.swinging) {
    target.combo.step = 0;
    target.combo.windowLeft = 0;
  }
  requestAnim(target, "hit", tDef);

  if (!attacker.combo.connected) {
    attacker.combo.connected = true;
    events.push({ type: "hit", attacker: attacker.slot, target: target.slot, step: attacker.combo.step });
  }
}

function advanceAnimation(f: FighterState, def: CharacterDef) {
  const a = animDef(def, f.anim);
  const dying = f.anim === "death";
  if (dying && f.frame >= a.frames - 1) {
    f.dead = true; // freeze on the last frame
    return;
  }
  f.animTick++;
  const hold = dying ? DEATH_FRAME_HOLD : (a.hold ?? FRAME_HOLD);
  if (f.animTick % hold === 0) {
    f.frame = f.frame < a.frames - 1 ? f.frame + 1 : dying ? f.frame : 0;
  }
}

function updateCombo(f: FighterState, def: CharacterDef, events: GameEvent[]) {
  const c = f.combo;
  if (c.swinging) {
    c.swingTick++;
    // Same release rule as the original: the swing is over when its last frame is reached.
    if (f.frame >= animDef(def, f.anim).frames - 1) {
      c.swinging = false;
      if (c.buffered && c.step < MAX_COMBO) {
        startSwing(f, (c.step + 1) as 2 | 3, def, events);
      } else if (c.step >= MAX_COMBO) {
        c.step = 0;
        c.windowLeft = 0;
      } else {
        c.windowLeft = COMBO_WINDOW_TICKS;
      }
    }
  } else if (c.windowLeft > 0) {
    c.windowLeft--;
    if (c.windowLeft === 0) c.step = 0;
  }
}

/**
 * Advance the match by exactly one tick. Mutates `state` and returns the events that happened
 * (sounds, etc.) so presentation never has to diff state.
 */
export function stepMatch(
  state: MatchState,
  inputs: readonly [InputFrame, InputFrame],
  rules: MatchRules,
): GameEvent[] {
  const events: GameEvent[] = [];
  state.tick++;

  if (state.phase === "countdown") {
    state.countdownTicks--;
    if (state.countdownTicks <= 0) {
      state.phase = "fighting";
      state.goTicks = GO_TICKS;
      events.push({ type: "go" });
    }
  } else if (state.phase === "fighting") {
    if (state.goTicks > 0) state.goTicks--;
    state.timeLeftTicks--;
  }

  const live = state.phase === "fighting";
  const [p0, p1] = state.fighters;

  // 1) Input -> intent
  const moveX: [number, number] = [0, 0];
  for (const f of state.fighters) {
    const def = getCharacter(f.characterId);
    const input = live && f.health > 0 ? inputs[f.slot] : EMPTY_INPUT;

    moveX[f.slot] = input.moveX;
    f.vx = input.moveX * MOVE_SPEED;
    if (input.moveX !== 0) f.facing = input.moveX < 0 ? "left" : "right";
    if (input.jump && f.canJump) {
      f.vy = JUMP_VELOCITY;
      f.jumps += 1;
      if (f.jumps >= 2) f.canJump = false;
    }
    if (input.attack) handleAttackInput(f, def, events);
  }

  // 2) Combat
  if (live) {
    for (const [a, t] of [[p0, p1], [p1, p0]] as const) {
      if (t.health <= 0 || t.invulnTicks > 0) continue;
      if (hitboxActive(a, getCharacter(a.characterId)) && attackConnects(a, t)) {
        applyHit(a, t, rules, events);
      }
    }
  }

  // 3) Physics (identical to the original Character.update)
  for (const f of state.fighters) {
    f.x += f.vx;
    f.y += f.vy;
    if (f.y + f.height + f.vy >= WORLD_HEIGHT) {
      f.vy = 0;
      f.canJump = true;
      f.jumps = 0;
    } else {
      f.vy += GRAVITY;
    }
    if (f.x <= 0) f.x = 0;
    if (f.x + f.width >= WORLD_WIDTH) f.x = WORLD_WIDTH - f.width;
  }

  // 4) Animation + combo bookkeeping
  for (const f of state.fighters) {
    const def = getCharacter(f.characterId);
    if (f.invulnTicks > 0) f.invulnTicks--;
    if (f.health <= 0 && f.anim !== "death") {
      f.lives = Math.max(0, f.lives - 1);
      f.respawnTicks = f.lives > 0 ? RESPAWN_TICKS : 0;
      f.combo.swinging = false;
      f.combo.step = 0;
      setAnim(f, "death");
      events.push({ type: "ko", slot: f.slot });
    } else if (f.health <= 0 && f.respawnTicks > 0 && state.phase === "fighting" && --f.respawnTicks === 0) {
      respawn(f);
      continue;
    } else if (f.health > 0) {
      const moving = moveX[f.slot] !== 0;
      const airborne = !isGrounded(f, 10);
      requestAnim(f, airborne ? "jump" : moving ? "run" : "idle", def);
    }
    advanceAnimation(f, def);
    updateCombo(f, def, events);
  }

  // 5) End conditions
  if (state.phase === "fighting") {
    if (p0.lives <= 0 || p1.lives <= 0) {
      state.phase = "over";
      state.endReason = "ko";
      state.winner = decideWinner(p0, p1);
    } else if (state.timeLeftTicks <= 0) {
      state.timeLeftTicks = 0;
      state.phase = "over";
      state.endReason = "time";
      state.winner = decideWinner(p0, p1);
    }
  }

  return events;
}
