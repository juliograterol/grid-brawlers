"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SOUND, getSound, setSound, subscribeSound } from "@/game/audio/settings";

/** Floating sound button + panel with independent switches for music and fight sound effects. */
export default function SoundSettings({ inMatch }: { inMatch: boolean }) {
  const [open, setOpen] = useState(false);
  // Server snapshot = defaults, so hydration matches; the stored values apply right after.
  const sound = useSyncExternalStore(subscribeSound, getSound, () => DEFAULT_SOUND);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // do not also leave the match
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <div className={`sound-settings ${inMatch ? "in-match" : ""}`}>
      <button
        className="btn ghost sound-fab"
        aria-expanded={open}
        aria-controls="sound-panel"
        onClick={() => setOpen((o) => !o)}
      >
        {sound.music || sound.sfx ? "♪" : "×"} Sound
      </button>
      {open && (
        <div id="sound-panel" className="sound-panel" role="dialog" aria-label="Sound settings">
          <Toggle label="Music" on={sound.music} onChange={(music) => setSound({ music })} />
          <Toggle label="Fight sound effects" on={sound.sfx} onChange={(sfx) => setSound({ sfx })} />
        </div>
      )}
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
