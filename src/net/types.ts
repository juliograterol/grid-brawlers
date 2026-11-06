// Online play: peer-to-peer over WebRTC, with Pusher used only for the initial handshake (see signaling.ts).
//
// Topology: the HOST (slot 0) runs the real simulation. The GUEST (slot 1) sends its inputs to the host
// and renders the snapshots the host sends back (see game/session/onlineSessions.ts).
// There is intentionally no chat message type.

import type { GameRules } from "@/game/rules";
import type { GameEvent, InputFrame, MatchState, SlotIndex } from "@/game/types";

export type RoomId = string;

export interface PlayerPick {
  characterId: string;
  name: string;
}

/** Messages on the wire. Game traffic only. */
export type NetMessage =
  /** Lobby: each side announces its pick (host = slot 0, guest = slot 1). */
  | ({ type: "ready"; slot: SlotIndex } & PlayerPick)
  /** Host -> guest: the match begins. */
  | { type: "start"; backgroundId: string; slots: [PlayerPick, PlayerPick]; rules: GameRules }
  /** Guest -> host: a change in held direction, or a jump/attack edge. */
  | { type: "input"; frame: InputFrame }
  /** Host -> guest, every tick: authoritative state plus the events produced by that tick. */
  | { type: "snapshot"; tick: number; state: MatchState; events: GameEvent[] }
  /** Guest -> host: please restart the match. */
  | { type: "rematch-request" }
  /** Host -> guest: the match was restarted. */
  | { type: "rematch" };

export interface MatchTransport {
  readonly roomId: RoomId;
  readonly localSlot: SlotIndex;
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage) => void): () => void;
  /** Fires once when the peer connection is lost or closed. */
  onClose(handler: () => void): () => void;
  close(): void;
}
