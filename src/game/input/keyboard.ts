import type { InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

export interface KeyBindings {
  left: string;
  right: string;
  jump: string;
  /** null = this source never attacks (single-player uses the mouse instead). */
  attack: string | null;
}

/** Same keys as the original game. `event.key` values; single letters are matched case-insensitively. */
export const P1_KEYS: KeyBindings = { left: "a", right: "d", jump: "w", attack: "f" };
export const P2_KEYS: KeyBindings = { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", attack: "0" };

const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);

export class KeyboardSource implements InputSource {
  private down = new Set<string>();
  /** Most recently pressed horizontal key wins, like the original `lastKey`. */
  private lastHorizontal: "left" | "right" | null = null;
  private jumpEdge = false;
  private attackEdge = false;
  private readonly keys: Set<string>;

  constructor(private bindings: KeyBindings, private target: Window = window) {
    this.keys = new Set(
      [bindings.left, bindings.right, bindings.jump, bindings.attack].filter((k): k is string => k !== null).map(norm),
    );
    target.addEventListener("keydown", this.onDown);
    target.addEventListener("keyup", this.onUp);
    target.addEventListener("blur", this.onBlur);
  }

  private onDown = (e: KeyboardEvent) => {
    const k = norm(e.key);
    if (!this.keys.has(k)) return;
    e.preventDefault(); // stop arrows from scrolling the page
    if (e.repeat) return;
    this.down.add(k);
    const b = this.bindings;
    if (k === norm(b.left)) this.lastHorizontal = "left";
    else if (k === norm(b.right)) this.lastHorizontal = "right";
    else if (k === norm(b.jump)) this.jumpEdge = true;
    else if (b.attack !== null && k === norm(b.attack)) this.attackEdge = true;
  };

  private onUp = (e: KeyboardEvent) => {
    this.down.delete(norm(e.key));
  };

  private onBlur = () => {
    this.down.clear();
    this.lastHorizontal = null;
  };

  poll(_ctx: InputContext): InputFrame {
    const l = this.down.has(norm(this.bindings.left));
    const r = this.down.has(norm(this.bindings.right));
    let moveX: -1 | 0 | 1 = 0;
    if (l && r) moveX = this.lastHorizontal === "left" ? -1 : 1;
    else if (l) moveX = -1;
    else if (r) moveX = 1;

    const frame: InputFrame = { moveX, jump: this.jumpEdge, attack: this.attackEdge };
    this.jumpEdge = false;
    this.attackEdge = false;
    return frame;
  }

  dispose() {
    this.target.removeEventListener("keydown", this.onDown);
    this.target.removeEventListener("keyup", this.onUp);
    this.target.removeEventListener("blur", this.onBlur);
  }
}
