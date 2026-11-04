import { EMPTY_INPUT, type InputFrame } from "../types";
import type { InputContext, InputSource } from "./types";

/** Single-player attack: primary mouse button (or a tap) on the game stage. */
export class PointerAttackSource implements InputSource {
  private edge = false;

  constructor(private element: HTMLElement) {
    element.addEventListener("pointerdown", this.onDown);
    element.addEventListener("contextmenu", this.onContext);
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // Taps on on-screen buttons are handled by TouchSource instead.
    if ((e.target as HTMLElement | null)?.closest("[data-touch-control]")) return;
    this.edge = true;
  };

  private onContext = (e: Event) => e.preventDefault();

  poll(_ctx: InputContext): InputFrame {
    const attack = this.edge;
    this.edge = false;
    return attack ? { ...EMPTY_INPUT, attack: true } : EMPTY_INPUT;
  }

  dispose() {
    this.element.removeEventListener("pointerdown", this.onDown);
    this.element.removeEventListener("contextmenu", this.onContext);
  }
}
