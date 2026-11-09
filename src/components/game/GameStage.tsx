"use client";

import { useEffect, useRef, useState } from "react";
import { getBackground } from "@/data/backgrounds";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/game/constants";
import { createGame, type GameHandle } from "@/game/createGame";
import type { MatchConfig } from "@/game/session/config";
import type { MatchTransport } from "@/net/types";
import { useFitScale } from "@/hooks/useFitScale";
import type { SlotIndex } from "@/game/types";
import { SoundPanel } from "../SoundSettings";
import TouchControls from "./TouchControls";

interface Props {
  config: MatchConfig;
  transport?: MatchTransport;
  onExit: () => void;
}

/**
 * Hosts the canvas. React only mounts/unmounts the game and shows the end-of-match buttons;
 * the game loop itself runs outside React and never triggers a re-render per frame.
 */
export default function GameStage({ config, transport, onExit }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const [handle, setHandle] = useState<GameHandle | null>(null);
  const [over, setOver] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  /** Online: the player whose settings menu is holding the match paused. */
  const [pausedSlot, setPausedSlot] = useState<SlotIndex | null>(null);
  const scale = useFitScale();
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    let cancelled = false;
    let created: GameHandle | null = null;
    createGame({
      canvas: canvasRef.current!,
      stage: stageRef.current!,
      config,
      transport,
      onMatchOver: () => setOver(true),
      onRestart: () => setOver(false),
      onDisconnect: () => setDisconnected(true),
      onPauseChange: setPausedSlot,
    }).then((h) => {
      if (cancelled) return h.dispose();
      created = h;
      handleRef.current = h;
      h.resize(scaleRef.current);
      setHandle(h);
    });
    return () => {
      cancelled = true;
      created?.dispose();
      handleRef.current = null;
      setHandle(null);
    };
  }, [config, transport]);

  useEffect(() => {
    handleRef.current?.resize(scale);
  }, [scale]);

  // Escape opens and closes the settings menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setSettingsOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!settingsOpen) setSoundOpen(false);
  }, [settingsOpen]);

  // The match is paused exactly while the menu is open (createGame ignores it once the match is over).
  useEffect(() => {
    if (!settingsOpen || !handle) return;
    handle.pause();
    return () => handle.resume();
  }, [settingsOpen, handle]);

  const bg = getBackground(config.backgroundId);
  const solo = config.slots.some(
    (s) => s.controller === "solo-p1" || s.controller === "online-local",
  );

  return (
    <div className="stage-root" style={{ ["--s" as string]: scale }}>
      <div
        ref={stageRef}
        className="stage"
        style={{ width: WORLD_WIDTH * scale, height: WORLD_HEIGHT * scale }}
      >
        <div
          className="stage-bg"
          style={{ backgroundImage: `url("${bg.src}")` }}
        />
        <canvas ref={canvasRef} className="stage-canvas" />

        {pausedSlot !== null && (
          <p className="pause-label" role="status">
            {config.slots[pausedSlot].name} Paused
          </p>
        )}

        {/* Inside the stage so the menu is centred on the game view itself; pointer events must not reach the game input. */}
        {settingsOpen && (
          <div
            className="settings-overlay"
            onClick={() => setSettingsOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div
              className="settings-menu"
              role="dialog"
              aria-label="Settings"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Settings</h2>
              <button className="btn" autoFocus onClick={onExit}>
                Back to menu
              </button>
              <button
                className="btn ghost"
                aria-expanded={soundOpen}
                aria-controls="settings-sound"
                onClick={() => setSoundOpen((o) => !o)}
              >
                Sound settings
              </button>
              {soundOpen && <SoundPanel id="settings-sound" />}
            </div>
          </div>
        )}
      </div>

      <button
        className="btn ghost exit-btn"
        onClick={() => setSettingsOpen((o) => !o)}
      >
        Settings
      </button>

      {disconnected && (
        <div className="result-actions">
          <p className="hint">Your opponent disconnected.</p>
          <button className="btn" onClick={onExit}>
            Back to menu
          </button>
        </div>
      )}

      {over && !disconnected && (
        <div className="result-actions">
          <button
            className="btn"
            onClick={() => {
              handleRef.current?.restart();
              setOver(false);
            }}
          >
            Rematch
          </button>
          <button className="btn ghost" onClick={onExit}>
            Back to menu
          </button>
        </div>
      )}

      {solo && <TouchControls touch={handle?.touch ?? null} />}
    </div>
  );
}
