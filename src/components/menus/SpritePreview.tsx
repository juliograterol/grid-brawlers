"use client";

import { useEffect, useRef } from "react";
import { rightUrl } from "@/data/sprites";
import type { CharacterDef } from "@/data/types";
import { assets } from "@/game/render/assets";

/** Animated idle loop drawn from the character's own sheet (so new characters preview automatically). */
export default function SpritePreview({ def, height = 150 }: { def: CharacterDef; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const anim = def.sprites.idle;
    const url = rightUrl(def, anim);
    let frame = 0;
    let timer: number | undefined;
    let cancelled = false;

    assets.load([url]).then(() => {
      const img = assets.get(url);
      if (!img || cancelled) return;
      const fw = img.width / anim.frames;
      canvas.height = height;
      canvas.width = Math.round((fw / img.height) * height);
      ctx.imageSmoothingEnabled = false;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, frame * fw, 0, fw, img.height, 0, 0, canvas.width, canvas.height);
        frame = (frame + 1) % anim.frames;
      };
      draw();
      timer = window.setInterval(draw, 120);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [def, height]);

  return <canvas ref={ref} className="sprite-preview" aria-hidden />;
}
