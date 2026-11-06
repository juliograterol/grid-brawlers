import type { GameEvent, MatchState } from "../types";
import { getCharacter } from "@/data/characters";
import { getSound, subscribeSound } from "./settings";

const BASE = "/assets/audio/";
const NAMES = ["swordAttack", "swordClash", "hitSound1", "hitSound2", "swordDeath1", "swordDeath2"];

/** Turns GameEvents into sounds. Presentation only: the sim never touches audio. */
export class AudioManager {
  private base = new Map<string, HTMLAudioElement>();
  muted = false;
  private playing = new Set<HTMLAudioElement>();
  private off = subscribeSound(() => {
    // Turning effects off cuts any effect that is still sounding.
    if (!getSound().sfx) {
      this.playing.forEach((a) => a.pause());
      this.playing.clear();
    }
  });

  constructor() {
    for (const n of NAMES) {
      const a = new Audio(`${BASE}${n}.mp3`);
      a.preload = "auto";
      this.base.set(n, a);
    }
  }

  private play(name: string, volume = 1) {
    if (this.muted || !getSound().sfx) return; // the "sound effects" switch covers every in-fight SFX
    const src = this.base.get(name);
    if (!src) return;
    const a = src.cloneNode() as HTMLAudioElement; // allows overlapping plays
    a.volume = volume;
    this.playing.add(a);
    a.addEventListener("ended", () => this.playing.delete(a), { once: true });
    a.play().catch(() => this.playing.delete(a)); // autoplay restrictions: ignore
  }

  dispose() {
    this.off();
    this.playing.forEach((a) => a.pause());
    this.playing.clear();
  }

  handle(events: GameEvent[], state: Readonly<MatchState>) {
    for (const e of events) {
      if (e.type === "swing") this.play("swordAttack", 0.6);
      else if (e.type === "hit") {
        const target = state.fighters[e.target];
        this.play(getCharacter(target.characterId).sounds.hit);
        this.play("swordClash", 0.8);
      } else if (e.type === "ko") {
        this.play(getCharacter(state.fighters[e.slot].characterId).sounds.death);
      }
    }
  }
}
