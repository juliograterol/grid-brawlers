"use client";

import { useEffect, useRef, useState } from "react";
import { getBackground } from "@/data/backgrounds";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/game/constants";
import { createGame, type GameHandle } from "@/game/createGame";
import type { MatchConfig } from "@/game/session/config";
import type { MatchTransport } from "@/net/types";
import { useFitScale } from "@/hooks/useFitScale";
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const bg = getBackground(config.backgroundId);
  const solo = config.slots.some((s) => s.controller === "solo-p1" || s.controller === "online-local");

  return (
    <div className="stage-root" style={{ ["--s" as string]: scale }}>
      <div
        ref={stageRef}
        className="stage"
        style={{ width: WORLD_WIDTH * scale, height: WORLD_HEIGHT * scale }}
      >
        <div className="stage-bg" style={{ backgroundImage: `url("${bg.src}")` }} />
        <canvas ref={canvasRef} className="stage-canvas" />
      </div>

      <button className="btn ghost exit-btn" onClick={onExit}>Menu (Esc)</button>

      {disconnected && (
        <div className="result-actions">
          <p className="hint">Your opponent disconnected.</p>
          <button className="btn" onClick={onExit}>Back to menu</button>
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
          <button className="btn ghost" onClick={onExit}>Back to menu</button>
        </div>
      )}

      {solo && <TouchControls touch={handle?.touch ?? null} />}
    </div>
  );
}
