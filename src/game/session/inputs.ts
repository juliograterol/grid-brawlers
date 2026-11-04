import { AISource } from "../input/ai";
import { CompositeSource } from "../input/composite";
import { KeyboardSource, P1_KEYS, P2_KEYS } from "../input/keyboard";
import { PointerAttackSource } from "../input/pointer";
import { RemoteInputSource } from "../input/remote";
import type { TouchSource } from "../input/touch";
import type { InputSource } from "../input/types";
import type { Controller } from "./config";

export interface InputEnv {
  /** Element that receives mouse/tap attacks in single player. */
  stage: HTMLElement;
  touch: TouchSource;
}

/** Map a slot's controller kind to a concrete input source. Add new kinds here. */
export function createInputSource(controller: Controller, env: InputEnv): InputSource {
  switch (controller) {
    case "keyboard-p1":
      return new KeyboardSource(P1_KEYS);
    case "keyboard-p2":
      return new KeyboardSource(P2_KEYS);
    case "solo-p1":
      // Movement/jump from the keyboard, attack from the mouse (+ on-screen buttons on touch devices).
      return new CompositeSource([
        new KeyboardSource({ ...P1_KEYS, attack: null }),
        new PointerAttackSource(env.stage),
        env.touch,
      ]);
    case "ai":
      return new AISource();
    case "remote":
      return new RemoteInputSource();
  }
}
