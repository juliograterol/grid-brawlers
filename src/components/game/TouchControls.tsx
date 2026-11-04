"use client";

import type { TouchSource } from "@/game/input/touch";
import { useMedia } from "@/hooks/useMedia";

interface Props {
  touch: TouchSource | null;
}

/** On-screen buttons for touch devices (single player). They only write into a TouchSource. */
export default function TouchControls({ touch }: Props) {
  const coarse = useMedia("(pointer: coarse)");
  if (!coarse || !touch) return null;

  const hold = (set: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      set(true);
    },
    onPointerUp: () => set(false),
    onPointerCancel: () => set(false),
  });
  const tap = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      fn();
    },
  });

  return (
    <div className="touch-controls" data-touch-control>
      <div className="touch-cluster left">
        <button aria-label="Move left" data-touch-control {...hold((v) => touch.setLeft(v))}>◀</button>
        <button aria-label="Move right" data-touch-control {...hold((v) => touch.setRight(v))}>▶</button>
      </div>
      <div className="touch-cluster right">
        <button aria-label="Jump" data-touch-control {...tap(() => touch.pressJump())}>⤒</button>
        <button aria-label="Attack" className="attack" data-touch-control {...tap(() => touch.pressAttack())}>⚔</button>
      </div>
    </div>
  );
}
