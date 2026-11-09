"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_LIVES,
  LIVES_OPTIONS,
  MAX_DURATION_MINUTES,
  parseDurationMinutes,
  rulesFromMenu,
  type GameMode,
  type GameRules,
  type Lives,
} from "@/game/rules";

interface Props {
  /** Called with validated rules once the player confirms. */
  onConfirm: (rules: GameRules) => void;
  onBack: () => void;
  /** Label of the confirm button. */
  confirmLabel?: string;
}

/**
 * Pre-match rules screen, shared by single player, local multiplayer and the online host.
 * Mouse: click the lives / buttons. Keyboard: type the minutes, Left/Right (or 1-3) change lives,
 * Enter confirms, Esc goes back.
 */
export default function RulesScreen({ onConfirm, onBack, confirmLabel = "START" }: Props) {
  const [minutes, setMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [mode, setMode] = useState<GameMode>("lives");
  const [lives, setLives] = useState<Lives>(DEFAULT_LIVES);
  const livesRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const invalid = mode === "time" && parseDurationMinutes(minutes) === null;

  const confirm = () => {
    const rules = rulesFromMenu(mode, minutes, lives); // invalid text -> 1 minute
    if (invalid) setMinutes(String(DEFAULT_DURATION_MINUTES));
    onConfirm(rules);
  };

  const chooseLives = (l: Lives, focus = false) => {
    setLives(l);
    if (focus) livesRefs.current[LIVES_OPTIONS.indexOf(l)]?.focus();
  };

  const onLivesKey = (e: React.KeyboardEvent) => {
    const i = LIVES_OPTIONS.indexOf(lives);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") chooseLives(LIVES_OPTIONS[Math.min(i + 1, 2)], true);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") chooseLives(LIVES_OPTIONS[Math.max(i - 1, 0)], true);
    else return;
    e.preventDefault();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onBack();
    } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      confirm();
    } else if (mode === "lives" && e.target instanceof HTMLButtonElement && /^[1-3]$/.test(e.key)) {
      chooseLives(Number(e.key) as Lives, true);
    }
  };

  return (
    <main className="menu lobby rules-menu" onKeyDown={onKeyDown}>
      <h2>Match Rules</h2>

      <section className="slot-panel rules-panel">
        <div className="rules-row">
          <span className="rules-label" id="rules-mode-label">Win condition</span>
          <div className="lives-group" role="radiogroup" aria-labelledby="rules-mode-label">
            {(["lives", "time"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={`lives-btn mode-btn ${mode === m ? "selected" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "lives" ? "Lives" : "Time"}
              </button>
            ))}
          </div>
        </div>
        <p className="hint">
          {mode === "lives"
            ? "No clock. Lose all your lives and you're out."
            : "Unlimited respawns. Most KOs when the clock hits 0 wins."}
        </p>

        {mode === "time" && (
        <>
        <label className="rules-row">
          <span className="rules-label">Fight duration (minutes)</span>
          <input
            className="name-input rules-input"
            type="text"
            inputMode="decimal"
            autoFocus
            maxLength={6}
            value={minutes}
            aria-invalid={invalid}
            aria-describedby="rules-duration-hint"
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <p id="rules-duration-hint" className={`hint ${invalid ? "error" : ""}`} role={invalid ? "alert" : undefined}>
          {invalid
            ? `Enter a number above 0 (max ${MAX_DURATION_MINUTES}). Otherwise ${DEFAULT_DURATION_MINUTES} minute is used.`
            : "Whole or decimal, e.g. 1, 2.5 or 0.5"}
        </p>
        </>
        )}

        {mode === "lives" && (
        <div className="rules-row">
          <span className="rules-label" id="rules-lives-label">Lives per fighter</span>
          <div className="lives-group" role="radiogroup" aria-labelledby="rules-lives-label" onKeyDown={onLivesKey}>
            {LIVES_OPTIONS.map((l, i) => (
              <button
                key={l}
                ref={(el) => {
                  livesRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={lives === l}
                tabIndex={lives === l ? 0 : -1}
                className={`lives-btn ${lives === l ? "selected" : ""}`}
                onClick={() => chooseLives(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        )}
      </section>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn" onClick={confirm}>{confirmLabel}</button>
      </div>
    </main>
  );
}
