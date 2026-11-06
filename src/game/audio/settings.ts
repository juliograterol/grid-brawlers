// Global sound settings: music and fight sound effects are independent switches, persisted in localStorage.
// No React in here; the UI subscribes through `subscribeSound` / `getSound`.

export interface SoundSettings {
  music: boolean;
  sfx: boolean;
}

const KEY = "grid-brawlers:sound";
export const DEFAULT_SOUND: SoundSettings = Object.freeze({ music: true, sfx: true });

let current: SoundSettings = DEFAULT_SOUND;
let loaded = false;
const listeners = new Set<() => void>();

function load(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return {
      music: typeof raw?.music === "boolean" ? raw.music : DEFAULT_SOUND.music,
      sfx: typeof raw?.sfx === "boolean" ? raw.sfx : DEFAULT_SOUND.sfx,
    };
  } catch {
    return DEFAULT_SOUND; // storage blocked or corrupt: sound on
  }
}

export function getSound(): SoundSettings {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    current = load();
  }
  return current;
}

/** Applied immediately: listeners (music player, UI) run synchronously. */
export function setSound(patch: Partial<SoundSettings>) {
  current = { ...getSound(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: setting still applies for this session */
  }
  listeners.forEach((l) => l());
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
