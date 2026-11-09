// Composition root for a match: wires config -> session (sim + inputs) -> loop -> renderer/audio.
// This is the only file that knows about all the layers; each layer only knows its neighbours' interfaces.

import { getCharacter } from "@/data/characters";
import { allSpriteUrls } from "@/data/sprites";
import { AudioManager } from "./audio/audio";
import { music } from "./audio/music";
import { TICK_RATE } from "./constants";
import type { InputSource } from "./input/types";
import { TouchSource } from "./input/touch";
import { GameLoop } from "./loop";
import { assets } from "./render/assets";
import { Renderer } from "./render/renderer";
import type { MatchConfig } from "./session/config";
import { createInputSource } from "./session/inputs";
import { LocalSession } from "./session/localSession";
import { GuestSession, HostSession } from "./session/onlineSessions";
import { RemoteInputSource } from "./input/remote";
import type { MatchTransport } from "@/net/types";
import type { MatchSession } from "./session/types";
import type { SlotIndex } from "./types";

export interface GameHandle {
  /** The on-screen buttons write into this. */
  touch: TouchSource;
  resize(cssScale: number): void;
  restart(): void;
  /** Stop game time (and tell the opponent online). No-op once the match is over or the opponent left. */
  pause(): void;
  resume(): void;
  dispose(): void;
}

export interface CreateGameOptions {
  canvas: HTMLCanvasElement;
  /** Element that receives mouse/tap input (the scaled stage). */
  stage: HTMLElement;
  config: MatchConfig;
  /** Fired once, shortly after the match ends (lets the death animation play first). */
  /** Online match: slot `transport.localSlot` is played here, the other slot over the wire. */
  transport?: MatchTransport;
  /** The match was restarted by the other side (online). */
  onRestart?: () => void;
  /** The other player left or the connection dropped (online). */
  onDisconnect?: () => void;
  /** Online only: which player's settings menu is holding the match paused (`null` = running). */
  onPauseChange?: (pausedSlot: SlotIndex | null) => void;
  onMatchOver?: (result: { winner: 0 | 1 | "tie"; name: string | null }) => void;
}

const RESULT_DELAY_TICKS = TICK_RATE * 1.5;

export async function createGame(opts: CreateGameOptions): Promise<GameHandle> {
  const { canvas, stage, config } = opts;

  await assets.load(config.slots.flatMap((s) => allSpriteUrls(getCharacter(s.characterId))));
  // Make sure the pixel font is ready before the first paint (canvas does not wait for fonts).
  try {
    const font = getComputedStyle(document.body).getPropertyValue("--font-pixel").trim() || '"Press Start 2P"';
    await document.fonts.load(`20px ${font}`);
  } catch {
    /* fall back to whatever is available */
  }

  const renderer = new Renderer(canvas);
  const audio = new AudioManager();
  const touch = new TouchSource();

  let overTicks = 0;
  let reported = false;
  let musicStopped = false;

  const transport = opts.transport;

  const buildSession = (): MatchSession => {
    overTicks = 0;
    reported = false;
    musicStopped = false;
    music.play("fight"); // fight start / rematch: crossfade from the menu music (or restart after the fight ended)
    if (transport) {
      const local = createInputSource(config.slots[transport.localSlot].controller, { stage, touch });
      if (transport.localSlot === 0) {
        return new HostSession(config, local, new RemoteInputSource(), transport);
      }
      return new GuestSession(config, local, transport);
    }
    const sources = config.slots.map((s) => createInputSource(s.controller, { stage, touch }));
    return new LocalSession(config, sources as [InputSource, InputSource]);
  };
  let session: MatchSession = buildSession();

  const restartSession = () => {
    session.dispose();
    session = buildSession();
  };
  // Pause: either player's settings menu freezes both sides. Never applies after the match ended or a disconnect.
  let localPaused = false;
  let remotePaused = false;
  let disconnected = false;
  const isPaused = () => !disconnected && session.state.phase !== "over" && (localPaused || remotePaused);
  const reportPause = () => {
    if (!transport) return;
    const slot = localPaused ? transport.localSlot : remotePaused ? ((1 - transport.localSlot) as SlotIndex) : null;
    opts.onPauseChange?.(isPaused() ? slot : null);
  };

  const offNet: (() => void)[] = [];
  if (transport) {
    offNet.push(
      transport.onMessage((m) => {
        if (m.type === "pause") {
          remotePaused = m.paused;
          reportPause();
        } else if (m.type === "rematch" && transport.localSlot === 1) {
          restartSession();
          opts.onRestart?.();
        } else if (m.type === "rematch-request" && transport.localSlot === 0) {
          restartSession();
          transport.send({ type: "rematch" });
          opts.onRestart?.();
        }
      }),
      transport.onClose(() => {
        disconnected = true;
        reportPause();
        opts.onDisconnect?.();
      }),
    );
  }

  const loop = new GameLoop(
    () => {
      if (isPaused()) return; // no game time elapses while a settings menu is open
      const events = session.step();
      audio.handle(events, session.state);
      if (session.state.phase === "over" && !musicStopped) {
        musicStopped = true;
        music.stop(); // the fight ended
      }
      if (session.state.phase === "over" && !reported && ++overTicks >= RESULT_DELAY_TICKS) {
        reported = true;
        const w = session.state.winner as 0 | 1 | "tie";
        opts.onMatchOver?.({ winner: w, name: w === "tie" ? null : session.state.fighters[w].name });
      }
    },
    () => renderer.draw(session.state),
  );
  loop.start();

  return {
    touch,
    resize: (s) => renderer.resize(s),
    restart() {
      if (transport?.localSlot === 1) {
        transport.send({ type: "rematch-request" }); // the host restarts and tells us back
        return;
      }
      restartSession();
      transport?.send({ type: "rematch" });
    },
    pause() {
      if (localPaused || disconnected || session.state.phase === "over") return;
      localPaused = true;
      transport?.send({ type: "pause", paused: true });
      reportPause();
    },
    resume() {
      if (!localPaused) return;
      localPaused = false;
      if (!disconnected) transport?.send({ type: "pause", paused: false });
      reportPause();
    },
    dispose() {
      offNet.forEach((off) => off());
      loop.stop();
      audio.dispose();
      session.dispose();
    },
  };
}
