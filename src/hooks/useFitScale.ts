"use client";

import { useEffect, useState } from "react";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/game/constants";

/** Largest scale at which the 1333x560 world fits the visible viewport (aspect ratio preserved). */
export function useFitScale(): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const vv = window.visualViewport;
      const w = vv?.width ?? window.innerWidth;
      const h = vv?.height ?? window.innerHeight;
      setScale(Math.max(0.1, Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT)));
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    window.visualViewport?.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      window.visualViewport?.removeEventListener("resize", compute);
    };
  }, []);

  return scale;
}
