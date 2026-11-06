import type { SlotIndex } from "@/game/types";
import type { MatchTransport, NetMessage, RoomId } from "./types";

/**
 * Two data channels on one peer connection:
 *  - "ctl":   reliable + ordered   (lobby, start, inputs, rematch)
 *  - "state": unordered, no retransmits (60 Hz snapshots; a late snapshot is worthless)
 */
export class RtcTransport implements MatchTransport {
  private messageHandlers = new Set<(m: NetMessage) => void>();
  private closeHandlers = new Set<() => void>();
  private closed = false;

  constructor(
    readonly roomId: RoomId,
    readonly localSlot: SlotIndex,
    private pc: RTCPeerConnection,
    private ctl: RTCDataChannel,
    private state: RTCDataChannel,
  ) {
    const onMessage = (e: MessageEvent) => {
      let msg: NetMessage;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      this.messageHandlers.forEach((h) => h(msg));
    };
    ctl.onmessage = onMessage;
    state.onmessage = onMessage;
    ctl.onclose = () => this.fireClose();
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.fireClose();
    };
  }

  send(message: NetMessage) {
    if (this.closed) return;
    const ch = message.type === "snapshot" ? this.state : this.ctl;
    if (ch.readyState === "open") ch.send(JSON.stringify(message));
  }

  onMessage(handler: (m: NetMessage) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onClose(handler: () => void) {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.messageHandlers.clear();
    this.closeHandlers.clear();
    this.ctl.close();
    this.state.close();
    this.pc.close();
  }

  private fireClose() {
    if (this.closed) return;
    this.closed = true;
    this.closeHandlers.forEach((h) => h());
    this.closeHandlers.clear();
    this.messageHandlers.clear();
    this.pc.close();
  }
}
