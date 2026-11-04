import { TICK_MS } from "./constants";

const MAX_CATCH_UP_TICKS = 5;

/**
 * Fixed-timestep loop: the simulation always advances in 1/60 s steps (deterministic, netcode-friendly),
 * rendering happens once per display frame. React is never involved per frame.
 */
export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(private onTick: () => void, private onFrame: () => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.acc += Math.min(now - this.last, TICK_MS * MAX_CATCH_UP_TICKS);
    this.last = now;
    while (this.acc >= TICK_MS) {
      this.onTick();
      this.acc -= TICK_MS;
    }
    this.onFrame();
    this.raf = requestAnimationFrame(this.frame);
  };
}
