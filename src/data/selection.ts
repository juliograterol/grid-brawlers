import type { CharacterDef } from "./types";

/**
 * Characters player `index` may still pick: everything not already taken by a player
 * who picks earlier. Taken characters are filtered out, not just disabled.
 * `picks[i]` is the choice of the i-th picker (null = undecided).
 */
export function availableCharacters(
  registry: readonly CharacterDef[],
  picks: readonly (string | null)[],
  index: number,
): CharacterDef[] {
  const taken = new Set(picks.slice(0, index).filter((p): p is string => p !== null));
  return registry.filter((c) => !taken.has(c.id));
}

/**
 * Re-validate picks after any change. Earlier pickers win; a later picker whose
 * character was taken is moved to the first character still available (or null).
 */
export function normalizePicks(
  registry: readonly CharacterDef[],
  picks: readonly (string | null)[],
): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < picks.length; i++) {
    const options = availableCharacters(registry, out, i);
    const current = picks[i];
    if (current !== null && options.some((c) => c.id === current)) out.push(current);
    else out.push(options[0]?.id ?? null);
  }
  return out;
}
