// Online sessions. The host simulates; the guest only sends inputs and displays what the host says.
//   HostSession  = LocalSession + "send a snapshot after every tick" + "feed guest inputs into slot 1"
//   GuestSession = polls the local player's input, sends changes, and applies the newest snapshot

import type { RemoteInputSource } from "../input/remote";
import type { InputSource } from "../input/types";
import type { MatchTransport } from "@/net/types";
import { createMatch } from "../sim";
import type { GameEvent, InputFrame, MatchState } from "../types";
import type { MatchConfig } from "./config";
import { LocalSession } from "./localSession";
import type { MatchSession } from "./types";

export class HostSession implements MatchSession {
  private inner: LocalSession;
  private off: () => void;

  constructor(
    config: MatchConfig,
    local: InputSource,
    remote: RemoteInputSource,
    private transport: MatchTransport,
  ) {
    this.inner = new LocalSession(config, [local, remote]);
    this.off = transport.onMessage((m) => {
      if (m.type === "input") remote.pushLatest(m.frame);
    });
  }

  get state(): MatchState {
    return this.inner.state;
  }

  step(): GameEvent[] {
    const events = this.inner.step();
    this.transport.send({ type: "snapshot", tick: this.inner.state.tick, state: this.inner.state, events });
    return events;
  }

  dispose() {
    this.off();
    this.inner.dispose();
  }
}

const sameHeld = (a: InputFrame, b: InputFrame) => a.moveX === b.moveX;

export class GuestSession implements MatchSession {
  state: MatchState;
  private lastTick = -1;
  private pending: GameEvent[] = [];
  private lastSent: InputFrame = { moveX: 0, jump: false, attack: false };
  private off: () => void;

  constructor(config: MatchConfig, private local: InputSource, private transport: MatchTransport) {
    this.state = createMatch([config.slots[0], config.slots[1]], config.rules);
    this.off = transport.onMessage((m) => {
      // Snapshots may arrive late or out of order. A big backwards jump means the host restarted the match.
      if (m.type !== "snapshot" || (m.tick <= this.lastTick && m.tick > this.lastTick - 120)) return;
      this.lastTick = m.tick;
      this.state = m.state;
      this.pending.push(...m.events);
    });
  }

  step(): GameEvent[] {
    // Poll every tick (consumes edge flags); only transmit when something changed.
    const frame = this.local.poll({ slot: this.transport.localSlot, tick: this.state.tick, state: this.state });
    if (frame.jump || frame.attack || !sameHeld(frame, this.lastSent)) {
      this.transport.send({ type: "input", frame });
      this.lastSent = frame;
    }
    const events = this.pending;
    this.pending = [];
    return events;
  }

  dispose() {
    this.off();
    this.local.dispose();
  }
}
