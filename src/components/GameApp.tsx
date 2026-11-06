"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { music } from "@/game/audio/music";
import type { GameMode, MatchConfig } from "@/game/session/config";
import GameStage from "./game/GameStage";
import LobbyScreen from "./menus/LobbyScreen";
import type { MatchTransport } from "@/net/types";
import ModeSelect from "./menus/ModeSelect";
import OnlineLobby from "./menus/OnlineLobby";
import RotatePrompt from "./RotatePrompt";
import SoundSettings from "./SoundSettings";

type Screen = { name: "mode" } | { name: "lobby"; mode: GameMode } | { name: "match"; config: MatchConfig; transport?: MatchTransport };

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
  const transportRef = useRef<MatchTransport | null>(null);
  const toMenu = useCallback(() => {
    transportRef.current?.close(); // leaving an online match disconnects from the opponent
    transportRef.current = null;
    setScreen({ name: "mode" });
  }, []);

  // Title screen, lobbies and rules menus share one looping track. The match switches to the fight track itself
  // (createGame), so nothing is done here while a match is on screen.
  const inMatch = screen.name === "match";
  useEffect(() => {
    if (!inMatch) music.play("menu");
  }, [inMatch]);

  const startOnline = useCallback((config: MatchConfig, transport: MatchTransport) => {
    tryLandscapeFullscreen();
    transportRef.current = transport;
    setScreen({ name: "match", config, transport });
  }, []);

  return (
    <>
      {screen.name === "mode" && <ModeSelect onSelect={(mode) => setScreen({ name: "lobby", mode })} />}
      {screen.name === "lobby" && screen.mode === "online" && <OnlineLobby onBack={toMenu} onStart={startOnline} />}
      {screen.name === "lobby" && screen.mode !== "online" && (
        <LobbyScreen
          mode={screen.mode}
          onBack={toMenu}
          onStart={(config) => {
            tryLandscapeFullscreen();
            setScreen({ name: "match", config });
          }}
        />
      )}
      {screen.name === "match" && <GameStage config={screen.config} transport={screen.transport} onExit={toMenu} />}
      <SoundSettings inMatch={inMatch} />
      <RotatePrompt />
    </>
  );
}
