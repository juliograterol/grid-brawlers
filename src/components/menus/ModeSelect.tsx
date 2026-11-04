"use client";

import type { GameMode } from "@/game/session/config";

interface Props {
  onSelect: (mode: GameMode) => void;
}

export default function ModeSelect({ onSelect }: Props) {
  return (
    <main className="menu">
      <h1 className="logo">Grid Brawlers</h1>
      <div className="mode-list">
        <button className="btn big" onClick={() => onSelect("single")}>
          Single Player
          <small>vs. CPU · A/D move · W jump · mouse click attacks</small>
        </button>
        <button className="btn big" onClick={() => onSelect("local")}>
          Local Multiplayer
          <small>P1: A/D/W + F · P2: arrows + 0</small>
        </button>
        {/* ONLINE EXTENSION POINT: enable once a RoomDirectory implementation exists (see src/net). */}
        <button className="btn big" disabled>
          Online Arenas
          <small>Coming soon · join by room ID or find an open arena</small>
        </button>
      </div>
    </main>
  );
}
