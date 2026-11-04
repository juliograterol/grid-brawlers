import type { InputFrame, MatchState, SlotIndex } from "../types";

export interface InputContext {
  slot: SlotIndex;
  tick: number;
  /** Read-only view of the match; used by AI (and could be used by prediction). Humans ignore it. */
  state: Readonly<MatchState>;
}

/**
 * Anything that can drive a fighter: keyboard, mouse, touch, AI, or a remote player.
 * The simulation only ever sees the InputFrame it returns, so sources are interchangeable per slot.
 */
export interface InputSource {
  /** Called exactly once per simulation tick. Edge flags (jump/attack) must be consumed here. */
  poll(ctx: InputContext): InputFrame;
  dispose(): void;
}
