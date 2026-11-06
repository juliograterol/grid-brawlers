// Player-configurable match rules. Pure data + validation, no DOM: shared by the menu, the sim and the network layer.

import { TICK_RATE } from "./constants";

export type Lives = 1 | 2 | 3;
export const LIVES_OPTIONS: readonly Lives[] = [1, 2, 3];

export interface GameRules {
  /** Fight length in seconds (the menu edits it in minutes). */
  durationSeconds: number;
  /** Lives per fighter. */
  lives: Lives;
}

export const DEFAULT_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 60;

export const DEFAULT_RULES: GameRules = Object.freeze({
  durationSeconds: DEFAULT_DURATION_MINUTES * 60,
  lives: 3,
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

export function rulesFromMenu(durationText: string, lives: Lives): GameRules {
  return { durationSeconds: Math.round(durationMinutesOrDefault(durationText) * 60), lives };
}

/** Re-validate rules that came from outside (the network): never trust the wire. */
export function sanitizeRules(raw: Partial<GameRules> | null | undefined): GameRules {
  const secs = Number(raw?.durationSeconds);
  const ok = Number.isFinite(secs) && secs > 0 && secs <= MAX_DURATION_MINUTES * 60;
  const lives = LIVES_OPTIONS.find((l) => l === raw?.lives) ?? DEFAULT_RULES.lives;
  return { durationSeconds: ok ? secs : DEFAULT_RULES.durationSeconds, lives };
}

export const durationTicks = (rules: GameRules) => Math.max(1, Math.round(rules.durationSeconds * TICK_RATE));

/** 75 -> "1:15" (HUD clock). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
