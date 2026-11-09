"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SOUND, getSound, setSound, subscribeSound } from "@/game/audio/settings";

/** Switches for music and fight sound effects. Used by the floating button (menus) and the in-match Settings menu. */
export function SoundPanel({ id }: { id?: string }) {
  // Server snapshot = defaults, so hydration matches; the stored values apply right after.
  const sound = useSyncExternalStore(subscribeSound, getSound, () => DEFAULT_SOUND);
  return (
    <div id={id} className="sound-panel" role="group" aria-label="Sound settings">
      <Toggle label="Music" on={sound.music} onChange={(music) => setSound({ music })} />
      <Toggle label="Fight sound effects" on={sound.sfx} onChange={(sfx) => setSound({ sfx })} />
    </div>
  );
}

/**
 * Floating sound button for the screens outside a match. During a match the sound controls live in the
 * Settings menu (GameStage), so nothing is rendered here.
 */
export default function SoundSettings({ inMatch }: { inMatch: boolean }) {
  const [open, setOpen] = useState(false);
  const sound = useSyncExternalStore(subscribeSound, getSound, () => DEFAULT_SOUND);

  useEffect(() => {
    if (!open || inMatch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, inMatch]);

  if (inMatch) return null;

  return (
    <div className="sound-settings">
      <button
        className="btn ghost sound-fab"
        aria-expanded={open}
        aria-controls="sound-panel"
        onClick={() => setOpen((o) => !o)}
      >
        {sound.music || sound.sfx ? "♪" : "×"} Sound
      </button>
      {open && <SoundPanel id="sound-panel" />}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`sound-toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <b>{on ? "ON" : "OFF"}</b>
    </button>
  );
}
