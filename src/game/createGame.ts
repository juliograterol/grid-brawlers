// Composition root for a match: wires config -> session (sim + inputs) -> loop -> renderer/audio.
// This is the only file that knows about all the layers; each layer only knows its neighbours' interfaces.

import { getCharacter } from "@/data/characters";
import { allSpriteUrls } from "@/data/sprites";
import { AudioManager } from "./audio/audio";
import { TICK_RATE } from "./constants";
import type { InputSource } from "./input/types";
import { TouchSource } from "./input/touch";
import { GameLoop } from "./loop";
import { assets } from "./render/assets";
import { Renderer } from "./render/renderer";
import type { MatchConfig } from "./session/config";
import { createInputSource } from "./session/inputs";
import { LocalSession } from "./session/localSession";
import type { MatchSession } from "./session/types";

export interface GameHandle {
  /** The on-screen buttons write into this. */
  touch: TouchSource;
  resize(cssScale: number): void;
  restart(): void;
  dispose(): void;
}

export interface CreateGameOptions {
  canvas: HTMLCanvasElement;
  /** Element that receives mouse/tap input (the scaled stage). */
  stage: HTMLElement;
  config: MatchConfig;
  /** Fired once, shortly after the match ends (lets the death animation play first). */
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

  const buildSession = (): MatchSession => {
    overTicks = 0;
    reported = false;
    const sources = config.slots.map((s) => createInputSource(s.controller, { stage, touch }));
    return new LocalSession(config, sources as [InputSource, InputSource]);
  };
  let session: MatchSession = buildSession();

  const loop = new GameLoop(
    () => {
      const events = session.step();
      audio.handle(events, session.state);
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
      session.dispose();
      session = buildSession();
    },
    dispose() {
      loop.stop();
      session.dispose();
    },
  };
}
