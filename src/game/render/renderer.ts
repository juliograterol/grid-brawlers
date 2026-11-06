// Draws a MatchState onto a canvas. Read-only with respect to the game: it never mutates state
// and never knows whether a fighter is local, AI or remote.

import { getCharacter } from "@/data/characters";
import { resolveSprite } from "@/data/sprites";
import { TICK_RATE, WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import { formatClock } from "../rules";
import type { FighterState, MatchState } from "../types";
import { assets } from "./assets";

const BAR_PAD = 10;
const BAR_H = 30;
const TIMER_W = 100;
const TIMER_H = 60;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private pixelFont: string;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
    this.pixelFont =
      getComputedStyle(document.body).getPropertyValue("--font-pixel").trim() || '"Press Start 2P", monospace';
    this.resize(1);
  }

  /** Keep logical coordinates at 1333x560 but back the canvas with enough pixels for the displayed size. */
  resize(cssScale: number) {
    const dpr = window.devicePixelRatio || 1;
    const r = Math.min(Math.max(cssScale * dpr, 1), 2.5);
    this.canvas.width = Math.round(WORLD_WIDTH * r);
    this.canvas.height = Math.round(WORLD_HEIGHT * r);
    this.ctx.setTransform(r, 0, 0, r, 0, 0);
  }

  draw(state: Readonly<MatchState>) {
    const { ctx } = this;
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    for (const f of state.fighters) this.drawFighter(f);
    this.drawHud(state);
  }

  private drawFighter(f: FighterState) {
    const { ctx } = this;
    const def = getCharacter(f.characterId);
    const { anim, url, flip } = resolveSprite(def, f.anim, f.facing);
    const img = assets.get(url);

    if (img) {
      const frameW = img.width / anim.frames;
      const dw = frameW * def.scale;
      const dh = img.height * def.scale;
      const dx = f.x - def.drawOffset.x;
      const dy = f.y - def.drawOffset.y;
      const frame = Math.min(f.frame, anim.frames - 1);
      if (flip) {
        // No dedicated left sheet: mirror the right-facing one around the frame's centre.
        ctx.save();
        ctx.translate(dx + dw, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, frame * frameW, 0, frameW, img.height, 0, 0, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, frame * frameW, 0, frameW, img.height, dx, dy, dw, dh);
      }
    }

    if (!f.dead) {
      ctx.font = `10px ${this.pixelFont}`;
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(f.name, f.x, f.y - 5);
      if (f.health < 100) {
        ctx.fillStyle = "black";
        ctx.fillRect(f.x - 10, f.y, 100, 5);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeRect(f.x - 10, f.y, 100, 5);
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - 10, f.y, Math.max(0, f.health), 5);
      }
    }
  }

  private drawHud(state: Readonly<MatchState>) {
    const { ctx } = this;
    const barW = WORLD_WIDTH / 2 - TIMER_W / 2 - BAR_PAD;
    const [p1, p2] = state.fighters;

    // Health bars: P1 drains toward the left edge, P2 toward the right edge (original layout).
    this.bar(BAR_PAD, barW, p1, "right");
    this.bar(WORLD_WIDTH / 2 + TIMER_W / 2, barW, p2, "left");
    // Lives sit under each bar, next to the outer edge.
    this.lives(BAR_PAD, p1, "left");
    this.lives(WORLD_WIDTH - BAR_PAD, p2, "right");

    // Timer box
    const tx = WORLD_WIDTH / 2 - TIMER_W / 2;
    ctx.fillStyle = "black";
    ctx.fillRect(tx, BAR_PAD, TIMER_W, TIMER_H);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, BAR_PAD, TIMER_W, TIMER_H);

    let timerText = "";
    if (state.phase === "fighting") {
      // The clock is always visible (the "GO!" banner is drawn big in the centre instead).
      timerText = formatClock(state.timeLeftTicks / TICK_RATE);
    } else if (state.phase === "over") {
      timerText = state.endReason === "ko" ? "K.O." : "0:00";
    } else {
      timerText = formatClock(state.timeLeftTicks / TICK_RATE);
    }
    this.centerText(timerText, WORLD_WIDTH / 2, BAR_PAD + TIMER_H / 2, timerText.length > 4 ? 16 : 20, "white");

    // Big centre banner
    let banner = "";
    if (state.phase === "countdown") banner = String(Math.ceil(state.countdownTicks / TICK_RATE));
    else if (state.phase === "fighting" && state.goTicks > 0) banner = "GO!";
    else if (state.phase === "over") {
      banner = state.winner === "tie" ? "Tie" : `${state.fighters[state.winner as 0 | 1].name} Wins!`;
    }
    if (banner) {
      this.centerText(banner, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, state.phase === "over" ? 40 : 72, "white", true);
    }
  }

  private bar(x: number, w: number, f: FighterState, anchor: "left" | "right") {
    const { ctx } = this;
    ctx.fillStyle = "black";
    ctx.fillRect(x, BAR_PAD, w, BAR_H);
    const fillW = (w * Math.max(0, f.health)) / 100;
    ctx.fillStyle = f.color;
    ctx.fillRect(anchor === "right" ? x + w - fillW : x, BAR_PAD, fillW, BAR_H);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, BAR_PAD, w, BAR_H);
  }

  /** One heart per life: filled = left, outline = lost. `edge` is the x of the bar's outer edge. */
  private lives(edge: number, f: FighterState, side: "left" | "right") {
    const { ctx } = this;
    const size = 9;
    const gap = 8;
    const y = BAR_PAD + BAR_H + 8;
    for (let i = 0; i < f.maxLives; i++) {
      const x = side === "left" ? edge + i * (size * 2 + gap) : edge - size * 2 - i * (size * 2 + gap);
      ctx.beginPath();
      ctx.moveTo(x + size, y + size * 1.7);
      ctx.bezierCurveTo(x - size * 0.4, y + size * 0.9, x + size * 0.1, y - size * 0.4, x + size, y + size * 0.55);
      ctx.bezierCurveTo(x + size * 1.9, y - size * 0.4, x + size * 2.4, y + size * 0.9, x + size, y + size * 1.7);
      ctx.fillStyle = i < f.lives ? "#e53935" : "rgba(0,0,0,0.55)";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private centerText(text: string, x: number, y: number, size: number, color: string, shadow = false) {
    const { ctx } = this;
    ctx.font = `${size}px ${this.pixelFont}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (shadow) {
      ctx.fillStyle = "black";
      ctx.fillText(text, x + 3, y + 3);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
