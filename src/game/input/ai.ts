import { getCharacter } from "@/data/characters";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import { attackBoxOf, attackConnects } from "../sim";
import type { FighterState, InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

export interface AITuning {
  /** 0..1 base eagerness to attack. Higher = more pressure, fewer pauses. Main difficulty knob. */
  aggression: number;
  /** Ticks (60/s) the AI lags behind the player's actions. 6 = twitchy, 14 = easy to bait. */
  reactionTicks: number;
  /** +/- random ticks added to the reaction delay on every decision. */
  reactionJitter: number;
  /** Only swing when the foe is at least this many px inside the reach (avoids whiffing at the edge). */
  attackMargin: number;
  /** When a swing is incoming: chance to guard (step out of reach) / to counter-swing. The rest is ignored. */
  guardChance: number;
  counterChance: number;
  /** Chance to hop when guarding against an incoming swing. */
  dodgeJumpChance: number;
  /** Chance to back off (instead of trading) right after being hit. */
  hurtRetreatChance: number;
  /** Rest after a combo, in ticks [min, max]; scaled down by aggression. */
  restTicks: [number, number];
  /** Relative odds of a 1-, 2- or 3-hit chain (scaled up with aggression). */
  chainWeights: [number, number, number];
  /** Ticks after the foe's swing ends during which the AI considers the foe "open" and punishes. */
  punishWindow: number;
  /** Health below this fraction makes the AI more cautious; the foe being below it makes it greedier. */
  lowHealth: number;
  /** Extra px beyond the foe's reach the AI tries to stay at while guarding. */
  guardSpacing: number;
}

export const DEFAULT_AI_TUNING: AITuning = {
  aggression: 0.6,
  reactionTicks: 9,
  reactionJitter: 4,
  attackMargin: 12,
  guardChance: 0.45,
  counterChance: 0.25,
  dodgeJumpChance: 0.35,
  hurtRetreatChance: 0.4,
  restTicks: [10, 40],
  chainWeights: [0.5, 0.3, 0.2],
  punishWindow: 22,
  lowHealth: 0.3,
  guardSpacing: 25,
};

type ActionKind =
  | "approach"
  | "retreat"
  | "guard"
  | "feint"
  | "attack"
  | "wait";

interface Action {
  kind: ActionKind;
  ticksLeft: number;
  /** attack: the opening swing was sent. */
  launched: boolean;
  /** attack: how many chain steps this attack wants. */
  chain: number;
  /** guard: hop once over the incoming swing. */
  dodge: boolean;
  /** feint: still closing in ("in") or backing off ("out"). */
  phase: "in" | "out";
}

/** What the AI remembers about the foe for `reactionTicks`. */
interface FoeSnapshot {
  swinging: boolean;
  anim: string;
}

/** Everything the decision code needs this tick, computed once. */
interface View {
  toward: -1 | 1;
  gap: number;
  reach: number;
  canHit: boolean;
  foeThreat: boolean;
  foeStunned: boolean;
  foeAirborne: boolean;
  foeWhiffed: boolean;
  foeAggressive: boolean;
  foeRetreating: boolean;
  foeReach: number;
  cornered: boolean;
  aggr: number;
  meLow: boolean;
  foeLow: boolean;
}

const IDLE: InputFrame = Object.freeze({
  moveX: 0,
  jump: false,
  attack: false,
});
const move = (d: -1 | 0 | 1, jump = false): InputFrame => ({
  moveX: d,
  jump,
  attack: false,
});
const swing = (): InputFrame => ({ moveX: 0, jump: false, attack: true });

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class AISource implements InputSource {
  private readonly t: AITuning;
  private readonly rng: () => number;

  private act: Action | null = null;
  private cooldown = 0;
  private mood = 0; // slow random drift added to aggression, so the CPU has "good" and "bad" streaks
  private delay = 9;

  private history: FoeSnapshot[] = [];
  private lastHealth = 100;
  private prevThreat = false;
  private prevFoeSwinging = false;
  private lastFoeSwingEnd = -9999;
  private foeSwingStarts: number[] = [];

  constructor(
    tuning: Partial<AITuning> = {},
    seed: number = (Math.random() * 0xffffffff) >>> 0,
  ) {
    this.t = { ...DEFAULT_AI_TUNING, ...tuning };
    this.rng = mulberry32(seed);
    this.delay = this.t.reactionTicks;
  }

  poll(ctx: InputContext): InputFrame {
    const me = ctx.state.fighters[ctx.slot];
    const foe = ctx.state.fighters[ctx.slot === 0 ? 1 : 0];
    if (ctx.state.phase !== "fighting" || me.health <= 0) {
      this.reset(me.health);
      return IDLE;
    }

    const seen = this.observe(foe, ctx.tick);
    if (this.cooldown > 0) this.cooldown--;
    const v = this.read(me, foe, seen, ctx.tick);

    // Interrupts: being hit, or a swing coming at us. Never while we are mid-swing (committed).
    const hurt = me.health < this.lastHealth - 1e-6;
    this.lastHealth = me.health;
    if (hurt) this.lastFoeSwingEnd = -9999;
    if (!me.combo.swinging) {
      if (hurt) this.onHurt(v);
      else if (v.foeThreat && !this.prevThreat) this.onThreat(v);
    }
    this.prevThreat = v.foeThreat;

    if (!this.act || this.act.ticksLeft <= 0) this.act = this.choose(v);
    return this.execute(me, v);
  }

  dispose() {}

  // ---------------------------------------------------------------- perception

  private reset(health: number) {
    this.act = null;
    this.history = [];
    this.foeSwingStarts = [];
    this.prevThreat = false;
    this.prevFoeSwinging = false;
    this.lastHealth = health;
  }

  /** Records the foe and returns what the AI "sees" `delay` ticks late. */
  private observe(foe: FighterState, tick: number): FoeSnapshot {
    this.history.push({ swinging: foe.combo.swinging, anim: foe.anim });
    if (this.history.length > 40) this.history.shift();

    if (foe.combo.swinging && !this.prevFoeSwinging)
      this.foeSwingStarts.push(tick);
    if (!foe.combo.swinging && this.prevFoeSwinging)
      this.lastFoeSwingEnd = tick;
    this.prevFoeSwinging = foe.combo.swinging;
    while (this.foeSwingStarts.length && tick - this.foeSwingStarts[0] > 240)
      this.foeSwingStarts.shift();

    const idx = Math.max(0, this.history.length - 1 - this.delay);
    return this.history[idx];
  }

  private read(
    me: FighterState,
    foe: FighterState,
    seen: FoeSnapshot,
    tick: number,
  ): View {
    const meCx = me.x + me.width / 2;
    const foeCx = foe.x + foe.width / 2;
    const toward: -1 | 1 = foeCx >= meCx ? 1 : -1;

    // Reach as if we were already facing the foe (turning costs one tick, handled when attacking).
    const faced: FighterState = {
      ...me,
      facing: toward === 1 ? "right" : "left",
    };
    const box = attackBoxOf(faced, getCharacter(me.characterId));
    const reach =
      toward === 1 ? box.x + box.width - (me.x + me.width) : me.x - box.x;
    const gap = Math.max(
      0,
      toward === 1 ? foe.x - (me.x + me.width) : me.x - (foe.x + foe.width),
    );

    const canHit =
      attackConnects(faced, foe) && gap <= reach - this.t.attackMargin;

    const foeFaced: FighterState = {
      ...foe,
      facing: toward === 1 ? "left" : "right",
    };
    const foeBox = attackBoxOf(foeFaced, getCharacter(foe.characterId));
    const foeReach =
      toward === 1
        ? foe.x - foeBox.x
        : foeBox.x + foeBox.width - (foe.x + foe.width);

    const meLow = me.health / 100 < this.t.lowHealth;
    const foeLow = foe.health / 100 < this.t.lowHealth;
    const aggr = clamp(
      this.t.aggression + this.mood + (foeLow ? 0.15 : 0) - (meLow ? 0.25 : 0),
      0.05,
      0.98,
    );

    return {
      toward,
      gap,
      reach,
      canHit,
      // Incoming = the foe (as seen after our reaction delay) is swinging and its real box reaches us.
      foeThreat: seen.swinging && attackConnects(foe, me),
      foeStunned: seen.anim === "hit",
      foeAirborne: foe.y + foe.height < WORLD_HEIGHT - 20,
      foeWhiffed:
        !foe.combo.swinging &&
        tick - this.lastFoeSwingEnd <= this.t.punishWindow,
      foeAggressive: this.foeSwingStarts.length >= 3,
      foeRetreating: foe.vx * toward > 0,
      foeReach,
      cornered:
        (toward === 1 && me.x <= 5) ||
        (toward === -1 && me.x + me.width >= WORLD_WIDTH - 5),
      aggr,
      meLow,
      foeLow,
    };
  }

  // ---------------------------------------------------------------- decisions

  private onThreat(v: View) {
    const r = this.rng();
    if (r < this.t.guardChance && !v.cornered) {
      this.setAct("guard", this.int(14, 26), {
        dodge: this.rng() < this.t.dodgeJumpChance,
      });
    } else if (r < this.t.guardChance + this.t.counterChance && v.canHit) {
      this.setAct("attack", 1); // trade blows: both hitboxes are live now, so this is a real exchange
    } // else: misread it and carry on (keeps the CPU beatable)
  }

  private onHurt(v: View) {
    if (this.rng() < this.t.hurtRetreatChance && !v.cornered)
      this.setAct("retreat", this.int(10, 20));
    else if (v.canHit) this.setAct("attack", 1);
    else this.act = null;
  }

  private choose(v: View): Action {
    this.delay = Math.max(
      0,
      this.t.reactionTicks +
        this.int(-this.t.reactionJitter, this.t.reactionJitter),
    );
    this.mood = clamp(this.mood + (this.rng() - 0.5) * 0.2, -0.25, 0.25);

    const a = v.aggr;
    const resting = this.cooldown > 0;
    const w: [ActionKind, number][] = [];

    // ATTACK: only when the swing would land. Punish a stunned or whiffing foe much more eagerly.
    let attack = v.canHit && !resting ? 0.35 + 0.9 * a : 0;
    if (v.foeStunned) attack *= 3;
    if (v.foeWhiffed) attack *= 2.5;
    if (v.cornered) attack *= 1.5;
    w.push(["attack", attack]);

    // APPROACH: close the gap; chase harder when the player runs away.
    let approach = v.canHit ? 0.05 : 0.5 + a;
    if (v.foeRetreating) approach *= 1.3;
    if (v.gap > v.reach * 2) approach *= 1.5;
    w.push(["approach", approach]);

    // RETREAT: make space when hurt, when cornered by pressure, or just to reset.
    let retreat =
      (v.canHit ? 0.25 : 0.1) * (1 - a) +
      (v.meLow ? 0.6 : 0) +
      (v.foeAggressive ? 0.2 : 0);
    if (v.cornered) retreat = 0;
    w.push(["retreat", retreat]);

    // GUARD: hold the edge of the foe's reach and wait for a whiff. Better vs. players who spam attacks.
    let guard =
      v.gap < v.foeReach + 80 ? 0.2 * (1 - a) + (v.foeAggressive ? 0.7 : 0) : 0;
    if (v.cornered) guard = 0;
    w.push(["guard", guard]);

    // FEINT: step to the edge of range and back to bait a swing. Only worth it vs. a passive foe.
    const feint =
      !v.canHit && v.gap < v.reach + 140 && !v.foeAggressive
        ? 0.15 + 0.3 * a
        : 0;
    w.push(["feint", feint]);

    // WAIT: breathe. More likely right after a combo.
    w.push(["wait", 0.12 + (resting ? 0.5 : 0)]);

    const kind = this.pick(w);
    const dur = {
      approach: [8, 20],
      retreat: [10, 24],
      guard: [15, 30],
      feint: [18, 28],
      attack: [1, 1],
      wait: [6, 18],
    }[kind] as [number, number];
    return this.makeAct(kind, this.int(dur[0], dur[1]));
  }

  private pick(ws: [ActionKind, number][]): ActionKind {
    let total = 0;
    for (const [, x] of ws) total += Math.max(0, x);
    if (total <= 0) return "wait";
    let r = this.rng() * total;
    for (const [k, x] of ws) {
      if (x <= 0) continue;
      r -= x;
      if (r <= 0) return k;
    }
    return "wait";
  }

  // ---------------------------------------------------------------- execution

  private execute(me: FighterState, v: View): InputFrame {
    const a = this.act;
    if (!a) return IDLE;
    const away = -v.toward as -1 | 1;
    a.ticksLeft--;

    switch (a.kind) {
      case "wait":
        return IDLE;

      case "approach": {
        if (v.canHit) return this.endAct();
        const hop = me.canJump && v.gap > v.reach * 2 && this.rng() < 0.01; // rare jump-in
        return move(v.toward, hop);
      }

      case "retreat": {
        if (v.cornered)
          return this.endAct(me.canJump ? move(v.toward, true) : IDLE); // hop out of the corner
        return move(away);
      }

      case "guard": {
        if (v.foeWhiffed && v.canHit && !this.cooldown) {
          this.setAct("attack", 1); // the foe swung and missed: punish
          return IDLE;
        }
        let jump = false;
        if (a.dodge && me.canJump) {
          jump = true;
          a.dodge = false;
        }
        if (v.cornered) return jump ? move(v.toward, true) : this.endAct();
        const tooClose = v.gap < v.foeReach + this.t.guardSpacing;
        return move(tooClose ? away : 0, jump);
      }

      case "feint": {
        if (v.foeThreat) {
          this.setAct("guard", this.int(14, 24), { dodge: false }); // they took the bait: back out of reach
          return move(away);
        }
        if (a.phase === "in") {
          if (v.gap <= v.reach + 20 || a.ticksLeft <= 8)
            a.phase = "out"; // stop right at the edge
          else return move(v.toward);
        }
        if (v.cornered) return this.endAct();
        return move(away);
      }

      case "attack":
        return this.executeAttack(me, v, a);
    }
  }

  private executeAttack(me: FighterState, v: View, a: Action): InputFrame {
    a.ticksLeft = 99; // an attack lasts until its combo is finished
    if (!a.launched) {
      if (me.facing !== (v.toward === 1 ? "right" : "left"))
        return move(v.toward); // turn first (1 tick)
      if (!v.canHit) return this.endAct(); // foe slipped away
      a.launched = true;
      a.chain = this.rollChain(v.aggr);
      return swing();
    }
    const c = me.combo;
    if (c.swinging) {
      // Queue the next chain step a few ticks into the swing, once.
      if (c.step < a.chain && !c.buffered && c.swingTick >= 4) return swing();
      return IDLE;
    }
    if (c.step > 0 && c.step < a.chain && c.windowLeft > 0 && v.canHit)
      return swing();

    // Combo finished (or the foe left): rest a little so the CPU isn't a combo machine.
    const [lo, hi] = this.t.restTicks;
    this.cooldown = Math.round(this.int(lo, hi) * (1.3 - v.aggr));
    return this.endAct();
  }

  // ---------------------------------------------------------------- helpers

  private makeAct(
    kind: ActionKind,
    ticks: number,
    extra: Partial<Action> = {},
  ): Action {
    return {
      kind,
      ticksLeft: ticks,
      launched: false,
      chain: 1,
      dodge: false,
      phase: "in",
      ...extra,
    };
  }

  private setAct(
    kind: ActionKind,
    ticks: number,
    extra: Partial<Action> = {},
  ): void {
    this.act = this.makeAct(kind, ticks, extra);
  }

  private endAct(out: InputFrame = IDLE): InputFrame {
    this.act = null;
    return out;
  }

  private rollChain(aggr: number): number {
    const [w1, w2, w3] = this.t.chainWeights;
    const weights = [w1, w2 * (0.5 + aggr), w3 * aggr * aggr * 2];
    const total = weights[0] + weights[1] + weights[2];
    let r = this.rng() * total;
    for (let i = 0; i < 3; i++) {
      r -= weights[i];
      if (r <= 0) return i + 1;
    }
    return 1;
  }

  /** Inclusive random integer. */
  private int(lo: number, hi: number): number {
    return lo + Math.floor(this.rng() * (hi - lo + 1));
  }
}
