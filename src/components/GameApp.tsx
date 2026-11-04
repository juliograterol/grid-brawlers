"use client";

import { useCallback, useState } from "react";
import type { GameMode, MatchConfig } from "@/game/session/config";
import GameStage from "./game/GameStage";
import LobbyScreen from "./menus/LobbyScreen";
import ModeSelect from "./menus/ModeSelect";
import RotatePrompt from "./RotatePrompt";

type Screen = { name: "mode" } | { name: "lobby"; mode: GameMode } | { name: "match"; config: MatchConfig };

/** On phones, fullscreen + landscape lock is only allowed from a user gesture; best effort. */
function tryLandscapeFullscreen() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  document.documentElement
    .requestFullscreen?.()
    .then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape"))
    .catch(() => {});
}

export default function GameApp() {
  const [screen, setScreen] = useState<Screen>({ name: "mode" });
  const toMenu = useCallback(() => setScreen({ name: "mode" }), []);

  return (
    <>
      {screen.name === "mode" && <ModeSelect onSelect={(mode) => setScreen({ name: "lobby", mode })} />}
      {screen.name === "lobby" && (
        <LobbyScreen
          mode={screen.mode}
          onBack={toMenu}
          onStart={(config) => {
            tryLandscapeFullscreen();
            setScreen({ name: "match", config });
          }}
        />
      )}
      {screen.name === "match" && <GameStage config={screen.config} onExit={toMenu} />}
      <RotatePrompt />
    </>
  );
}
