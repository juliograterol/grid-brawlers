import type { InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

/** Fed by the on-screen buttons (TouchControls component); polled by the sim like any other source. */
export class TouchSource implements InputSource {
  private left = false;
  private right = false;
  private jumpEdge = false;
  private attackEdge = false;

  setLeft(v: boolean) { this.left = v; }
  setRight(v: boolean) { this.right = v; }
  pressJump() { this.jumpEdge = true; }
  pressAttack() { this.attackEdge = true; }

  poll(_ctx: InputContext): InputFrame {
    const moveX: -1 | 0 | 1 = this.left === this.right ? 0 : this.left ? -1 : 1;
    const frame: InputFrame = { moveX, jump: this.jumpEdge, attack: this.attackEdge };
    this.jumpEdge = false;
    this.attackEdge = false;
    return frame;
  }

  dispose() {}
}
