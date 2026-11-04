import type { InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

/** Merge several sources into one slot (e.g. keyboard movement + mouse attack + touch buttons). */
export class CompositeSource implements InputSource {
  constructor(private sources: InputSource[]) {}

  poll(ctx: InputContext): InputFrame {
    let moveX = 0;
    let jump = false;
    let attack = false;
    for (const s of this.sources) {
      const f = s.poll(ctx); // poll every source so every edge flag is consumed
      if (moveX === 0) moveX = f.moveX;
      jump ||= f.jump;
      attack ||= f.attack;
    }
    return { moveX: moveX as -1 | 0 | 1, jump, attack };
  }

  dispose() {
    this.sources.forEach((s) => s.dispose());
  }
}
