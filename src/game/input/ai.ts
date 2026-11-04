import { attackConnects } from "../sim";
import { WORLD_WIDTH } from "../constants";
import type { InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

const PAUSE_AFTER_SWING = 6; // original: movement paused for 100ms while attacking
const COOLDOWN_AFTER_COMBO = 14;
const MAX_AI_CHAIN = 2;

/**
 * Port of the original `enemyIA` block, restated as a pure "state -> InputFrame" function.
 * It only reads the match state, so the same class can later run server-side (bots in online rooms).
 */
export class AISource implements InputSource {
  private dir: -1 | 1 = -1;
  private pause = 0;
  private cooldown = 0;
  private wasSwinging = false;

  poll(ctx: InputContext): InputFrame {
    const me = ctx.state.fighters[ctx.slot];
    const foe = ctx.state.fighters[ctx.slot === 0 ? 1 : 0];
    const idle: InputFrame = { moveX: 0, jump: false, attack: false };
    if (ctx.state.phase !== "fighting" || me.health <= 0) return idle;

    if (this.cooldown > 0) this.cooldown--;
    if (this.pause > 0) this.pause--;

    // Chase
    if (foe.x + foe.width <= me.x) this.dir = -1;
    else if (foe.x >= me.x + me.width) this.dir = 1;
    // Don't get stuck on the walls
    if (me.x <= 0) this.dir = 1;
    if (me.x + me.width >= WORLD_WIDTH) this.dir = -1;

    const apart = me.x + me.width <= foe.x || me.x >= foe.x + foe.width;
    const inRange = attackConnects(me, foe);
    let move = true;
    let jump = false;
    let attack = false;

    if (apart) {
      if ((foe.jumps > 0 || foe.combo.swinging) && me.canJump) jump = true; // mirror jumps / dodge
      if (inRange) {
        if (!me.combo.swinging && this.cooldown === 0) {
          attack = true; // starts a swing, or chains the next step if still inside the combo window
          this.pause = PAUSE_AFTER_SWING;
        }
      }
    } else if (inRange) {
      move = false;
    }

    // Dodge: step away from an incoming swing and hop
    if (foe.combo.swinging && attackConnects(foe, me)) {
      this.dir = foe.facing === "left" ? 1 : -1;
      move = true;
      if (me.canJump) jump = true;
    }

    // After the AI's chain is done, rest briefly so it isn't an infinite combo machine.
    if (this.wasSwinging && !me.combo.swinging && me.combo.step >= MAX_AI_CHAIN) {
      this.cooldown = COOLDOWN_AFTER_COMBO;
    }
    this.wasSwinging = me.combo.swinging;
    if (this.pause > 0) move = false;

    return { moveX: move ? this.dir : 0, jump, attack };
  }

  dispose() {}
}
