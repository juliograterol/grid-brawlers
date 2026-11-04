import type { GameEvent, MatchState } from "../types";

/**
 * What the game loop and renderer talk to. A LocalSession simulates by itself;
 * an OnlineSession would implement the same interface on top of a transport
 * (lockstep/rollback: step() simulates; snapshot mode: step() applies the latest server state).
 */
export interface MatchSession {
  readonly state: Readonly<MatchState>;
  /** Advance one fixed tick and report what happened. */
  step(): GameEvent[];
  dispose(): void;
}
