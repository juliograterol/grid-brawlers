// Player-configurable match rules. Pure data + validation, no DOM: shared by the menu, the sim and the network layer.

import { TICK_RATE } from "./constants";

export type Lives = 1 | 2 | 3;
export const LIVES_OPTIONS: readonly Lives[] = [1, 2, 3];

export type GameMode = "time" | "lives";

/**
 * A match is decided by time OR by lives, never both:
 * - "time": fixed clock, unlimited respawns; most KOs when the clock hits 0 wins.
 * - "lives": no clock; first fighter to lose all lives loses.
 */
export type GameRules =
  | { mode: "time"; /** Fight length in seconds (the menu edits it in minutes). */ durationSeconds: number }
  | { mode: "lives"; lives: Lives };

export const DEFAULT_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 60;

export const DEFAULT_LIVES: Lives = 3;

export const DEFAULT_RULES: GameRules = Object.freeze({
  mode: "lives",
  lives: DEFAULT_LIVES,
});

/**
 * Parse the minutes text field. Accepts positive whole or decimal numbers ("2", "0.5", "1,5", ".5").
 * Anything else (empty, 0, negative, letters, exponent, > MAX_DURATION_MINUTES) -> `null`.
 */
export function parseDurationMinutes(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n <= MAX_DURATION_MINUTES ? n : null;
}

/** Text -> minutes, falling back to the 1-minute default when invalid. */
export function durationMinutesOrDefault(text: string): number {
  return parseDurationMinutes(text) ?? DEFAULT_DURATION_MINUTES;
}

export function rulesFromMenu(mode: GameMode, durationText: string, lives: Lives): GameRules {
  if (mode === "time") return { mode, durationSeconds: Math.round(durationMinutesOrDefault(durationText) * 60) };
  return { mode, lives };
}

/** Re-validate rules that came from outside (the network): never trust the wire. */
export function sanitizeRules(raw: unknown): GameRules {
  const r = (raw ?? {}) as { mode?: unknown; durationSeconds?: unknown; lives?: unknown };
  if (r.mode === "time") {
    const secs = Number(r.durationSeconds);
    const ok = Number.isFinite(secs) && secs > 0 && secs <= MAX_DURATION_MINUTES * 60;
    return { mode: "time", durationSeconds: ok ? secs : DEFAULT_DURATION_MINUTES * 60 };
  }
  return { mode: "lives", lives: LIVES_OPTIONS.find((l) => l === r.lives) ?? DEFAULT_LIVES };
}

/** Clock length in ticks; 0 in lives mode (no clock). */
export const durationTicks = (rules: GameRules) =>
  rules.mode === "time" ? Math.max(1, Math.round(rules.durationSeconds * TICK_RATE)) : 0;

/** 75 -> "1:15" (HUD clock). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
