"use client";

import { useState } from "react";
import { useMedia } from "@/hooks/useMedia";

/** On touch devices held in portrait, ask the player to rotate. Dismissable. */
export default function RotatePrompt() {
  const portraitTouch = useMedia("(orientation: portrait) and (pointer: coarse)");
  const [dismissed, setDismissed] = useState(false);
  if (!portraitTouch || dismissed) return null;

  return (
    <div className="rotate-prompt" role="dialog" aria-label="Rotate your device">
      <div className="rotate-icon" aria-hidden>📱</div>
      <p>Rotate your device to landscape for the best fight.</p>
      <button className="btn ghost" onClick={() => setDismissed(true)}>
        Play anyway
      </button>
    </div>
  );
}
