// Pusher Channels as a signaling relay. Clients only SUBSCRIBE here; every publish goes through
// /api/room so the Pusher secret never reaches the browser.

export type SignalKind = "join" | "offer" | "answer" | "busy" | "leave";

export interface Signal {
  from: string;
  /** Present when the message is for one specific peer; everyone else ignores it. */
  to?: string;
  kind: SignalKind;
  sdp?: string;
}

export async function roomExists(roomId: string): Promise<boolean> {
  const res = await fetch(`/api/room?roomId=${encodeURIComponent(roomId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not reach the matchmaking server.");
  return Boolean((await res.json()).occupied);
}

export class Signaling {
  readonly peerId = crypto.randomUUID().slice(0, 12);
  private handlers = new Set<(s: Signal) => void>();
  private pusher: import("pusher-js").default | null = null;
  private channelName: string;

  constructor(private roomId: string) {
    this.channelName = `room-${roomId.toUpperCase()}`;
  }

  /** Resolves once the subscription is live (for the host, that is what makes the room "exist"). */
  async connect(): Promise<void> {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) throw new Error("Pusher is not configured (see .env.example).");

    const { default: Pusher } = await import("pusher-js");
    const pusher = new Pusher(key, { cluster });
    this.pusher = pusher;
    const channel = pusher.subscribe(this.channelName);
    channel.bind("signal", (s: Signal) => {
      if (s.from === this.peerId || (s.to && s.to !== this.peerId)) return;
      this.handlers.forEach((h) => h(s));
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Could not connect to the matchmaking server.")), 10000);
      channel.bind("pusher:subscription_succeeded", () => {
        clearTimeout(timer);
        resolve();
      });
      channel.bind("pusher:subscription_error", () => {
        clearTimeout(timer);
        reject(new Error("Could not connect to the matchmaking server."));
      });
    });
  }

  onSignal(handler: (s: Signal) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async send(kind: SignalKind, extra: { to?: string; sdp?: string } = {}): Promise<void> {
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: this.roomId, from: this.peerId, kind, ...extra }),
    });
    if (!res.ok) throw new Error("Matchmaking request failed.");
  }

  close() {
    this.handlers.clear();
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
  }
}
