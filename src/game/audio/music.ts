// Background music. Web Audio (decoded buffer + `loop = true`) instead of <audio loop>, because MP3 playback through
// media elements leaves an audible gap at the loop point. One track plays at a time; switching crossfades.
// Nothing sounds before the user's first interaction (browser autoplay policy): requests made earlier are queued.

import { getSound, subscribeSound } from "./settings";

export type MusicTrack = "menu" | "fight";

const TRACKS: Record<MusicTrack, { src: string; volume: number }> = {
  menu: { src: "/assets/audio/echoes_of_lumen-battle-cinematic-heroic-orchestra.mp3", volume: 0.6 },
  fight: { src: "/assets/audio/alexgrohl-battle.mp3", volume: 0.45 },
};

const FADE = 0.5; // seconds
const MUTE_RAMP = 0.03; // click-free but effectively immediate

class MusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<MusicTrack, Promise<AudioBuffer>>();
  private active: { track: MusicTrack; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** What the current scene wants; null = silence. */
  private wanted: MusicTrack | null = null;
  private unlockBound = false;

  constructor() {
    subscribeSound(() => this.applyMute());
  }

  /** Start (or switch to) a track. Calling it again for the track already playing does nothing. */
  play(track: MusicTrack) {
    if (typeof window === "undefined") return;
    this.wanted = track;
    this.listenForInteraction();
    void this.sync();
  }

  /** Fade out and stop. */
  stop() {
    this.wanted = null;
    void this.sync();
  }

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = getSound().music ? 1 : 0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private listenForInteraction() {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const events = ["pointerdown", "keydown", "touchend"] as const;
    const unlock = () => {
      events.forEach((e) => window.removeEventListener(e, unlock, true));
      this.unlockBound = false;
      void this.sync();
    };
    events.forEach((e) => window.addEventListener(e, unlock, true));
  }

  private load(track: MusicTrack, ctx: AudioContext) {
    let p = this.buffers.get(track);
    if (!p) {
      p = fetch(TRACKS[track].src)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b));
      p.catch(() => this.buffers.delete(track)); // allow a retry
      this.buffers.set(track, p);
    }
    return p;
  }

  private async sync() {
    const want = this.wanted;
    if (this.active?.track === want) return;
    if (want === null) return this.fadeOutActive();

    const ctx = this.ensureContext();
    // Still locked (no user gesture yet): resume() only succeeds after one; the unlock listener calls sync again.
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    if (ctx.state !== "running") return;

    let buffer: AudioBuffer;
    try {
      buffer = await this.load(want, ctx);
    } catch {
      return;
    }
    if (this.wanted !== want || this.active?.track === want) return; // scene changed while loading

    this.fadeOutActive();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true; // sample-accurate loop of the whole decoded buffer
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(TRACKS[want].volume, ctx.currentTime + FADE);
    src.connect(gain).connect(this.master!);
    src.start();
    this.active = { track: want, src, gain };
  }

  private fadeOutActive() {
    const a = this.active;
    if (!a || !this.ctx) return;
    this.active = null;
    const t = this.ctx.currentTime;
    a.gain.gain.cancelScheduledValues(t);
    a.gain.gain.setValueAtTime(a.gain.gain.value, t);
    a.gain.gain.linearRampToValueAtTime(0, t + FADE);
    a.src.stop(t + FADE + 0.05);
    a.src.onended = () => a.gain.disconnect();
  }

  /** The music switch: silences everything now (also what is mid-fade); turning it back on resumes the loop. */
  private applyMute() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(getSound().music ? 1 : 0, t + MUTE_RAMP);
  }
}

export const music = new MusicPlayer();
