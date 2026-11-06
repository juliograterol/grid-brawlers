import { AI_DAMAGE_MULTIPLIER } from "../constants";
import type { InputSource } from "../input/types";
import { createMatch, stepMatch } from "../sim";
import type { GameEvent, MatchRules, MatchState } from "../types";
import type { MatchConfig } from "./config";
import type { MatchSession } from "./types";

/** Everything simulated in this browser tab; every slot has a local InputSource (keyboard, AI, ...). */
export class LocalSession implements MatchSession {
  readonly state: MatchState;
  private rules: MatchRules;

  constructor(private config: MatchConfig, private sources: [InputSource, InputSource]) {
    this.state = createMatch([config.slots[0], config.slots[1]], config.rules);
    this.rules = {
      // Original: the AI enemy dealt double damage.
      slotDamageMultiplier: [1, config.slots[1].controller === "ai" ? AI_DAMAGE_MULTIPLIER : 1],
    };
  }

  step(): GameEvent[] {
    const tick = this.state.tick;
    const [a, b] = this.sources;
    const inputs = [
      a.poll({ slot: 0, tick, state: this.state }),
      b.poll({ slot: 1, tick, state: this.state }),
    ] as const;
    return stepMatch(this.state, inputs, this.rules);
  }

  dispose() {
    this.sources.forEach((s) => s.dispose());
  }
}
