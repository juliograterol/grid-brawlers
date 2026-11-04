import type { GameEvent, MatchState } from "../types";
import { getCharacter } from "@/data/characters";

const BASE = "/assets/audio/";
const NAMES = ["swordAttack", "swordClash", "hitSound1", "hitSound2", "swordDeath1", "swordDeath2"];

/** Turns GameEvents into sounds. Presentation only: the sim never touches audio. */
export class AudioManager {
  private base = new Map<string, HTMLAudioElement>();
  muted = false;

  constructor() {
    for (const n of NAMES) {
      const a = new Audio(`${BASE}${n}.mp3`);
      a.preload = "auto";
      this.base.set(n, a);
    }
  }

  private play(name: string, volume = 1) {
    if (this.muted) return;
    const src = this.base.get(name);
    if (!src) return;
    const a = src.cloneNode() as HTMLAudioElement; // allows overlapping plays
    a.volume = volume;
    a.play().catch(() => {}); // autoplay restrictions: ignore
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
