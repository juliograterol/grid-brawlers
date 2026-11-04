import { EMPTY_INPUT, type InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

/**
 * ONLINE EXTENSION POINT: stands in for a human on another machine.
 * A transport calls `push(tick, frame)` as remote inputs arrive; the sim polls it like any other source.
 * With no input for a tick it repeats the last known movement (simple prediction) and never repeats edges.
 */
export class RemoteInputSource implements InputSource {
  private frames = new Map<number, InputFrame>();
  private last: InputFrame = EMPTY_INPUT;

  push(tick: number, frame: InputFrame) {
    this.frames.set(tick, frame);
  }

  poll(ctx: InputContext): InputFrame {
    const f = this.frames.get(ctx.tick);
    if (f) {
      this.frames.delete(ctx.tick);
      this.last = f;
      return f;
    }
    return { moveX: this.last.moveX, jump: false, attack: false };
  }

  dispose() {
    this.frames.clear();
  }
}
