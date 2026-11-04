"use client";

import { useMemo, useState } from "react";
import { BACKGROUNDS } from "@/data/backgrounds";
import { CHARACTERS } from "@/data/characters";
import { availableCharacters, normalizePicks } from "@/data/selection";
import type { GameMode, MatchConfig } from "@/game/session/config";
import SpritePreview from "./SpritePreview";

interface Props {
  mode: GameMode;
  onStart: (config: MatchConfig) => void;
  onBack: () => void;
}

export default function LobbyScreen({ mode, onStart, onBack }: Props) {
  const single = mode === "single";
  const slotLabels = single ? ["You", "CPU"] : ["Player 1", "Player 2"];

  const [picks, setPicks] = useState<(string | null)[]>(() =>
    normalizePicks(CHARACTERS, [CHARACTERS[0]?.id ?? null, null]),
  );
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);

  // Slot 0 picks first; slot 1 only sees what is left.
  const options = useMemo(() => picks.map((_, i) => availableCharacters(CHARACTERS, picks, i)), [picks]);

  const pick = (slot: number, id: string) =>
    setPicks((prev) => normalizePicks(CHARACTERS, prev.map((p, i) => (i === slot ? id : p))));

  const ready = picks.every((p) => p !== null);

  const start = () => {
    if (!ready) return;
    const fallback = single ? ["Player 1", "CPU"] : ["Player 1", "Player 2"];
    onStart({
      mode,
      backgroundId,
      slots: [
        {
          characterId: picks[0]!,
          name: names[0].trim() || fallback[0],
          controller: single ? "solo-p1" : "keyboard-p1",
        },
        {
          characterId: picks[1]!,
          name: names[1].trim() || fallback[1],
          controller: single ? "ai" : "keyboard-p2",
        },
      ],
    });
  };

  return (
    <main className="menu lobby">
      <h2>{single ? "Single Player" : "Local Multiplayer"}</h2>

      <div className="slots">
        {[0, 1].map((slot) => (
          <section key={slot} className="slot-panel">
            <h3>{slotLabels[slot]}</h3>
            <input
              className="name-input"
              placeholder={slot === 1 && single ? "CPU" : `Player ${slot + 1}`}
              maxLength={12}
              value={names[slot]}
              onChange={(e) => setNames((n) => (slot === 0 ? [e.target.value, n[1]] : [n[0], e.target.value]))}
            />
            <div className="char-grid" role="radiogroup" aria-label={`${slotLabels[slot]} character`}>
              {options[slot].map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={picks[slot] === c.id}
                  className={`char-card ${picks[slot] === c.id ? "selected" : ""}`}
                  style={{ ["--accent" as string]: c.color }}
                  onClick={() => pick(slot, c.id)}
                >
                  <SpritePreview def={c} height={110} />
                  <span>{c.name}</span>
                </button>
              ))}
              {options[slot].length === 0 && <p className="hint">No characters left to pick.</p>}
            </div>
          </section>
        ))}
      </div>

      <section className="bg-panel">
        <h3>Arena</h3>
        <div className="bg-grid" role="radiogroup" aria-label="Background">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              role="radio"
              aria-checked={backgroundId === b.id}
              className={`bg-card ${backgroundId === b.id ? "selected" : ""}`}
              onClick={() => setBackgroundId(b.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.thumbnail ?? b.src} alt="" />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn" onClick={start} disabled={!ready}>START</button>
      </div>
    </main>
  );
}
