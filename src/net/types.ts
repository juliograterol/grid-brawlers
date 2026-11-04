// ONLINE EXTENSION POINT (types only, no networking yet).
//
// Intended wiring once a backend exists:
//   1. Lobby UI calls RoomDirectory.listOpenRooms() ("find open arenas") or createRoom()/joinRoom(roomId).
//   2. joinRoom() resolves to a MatchTransport. The room assigns slots: the local player gets a local
//      controller ("solo-p1"/keyboard) and the other slot gets controller "remote".
//   3. createGame() builds a RemoteInputSource for the remote slot and the transport pushes
//      remote InputFrames into it (see game/input/remote.ts). For an authoritative server, implement
//      a MatchSession (game/session/types.ts) that applies server snapshots instead of LocalSession.
// There is intentionally no chat message type.

import type { InputFrame, MatchState, SlotIndex } from "@/game/types";

export type RoomId = string;

export type RoomStatus = "open" | "full" | "in-match";

export interface RoomInfo {
  id: RoomId;
  hostName: string;
  status: RoomStatus;
  players: number;
  maxPlayers: number;
  backgroundId: string;
  createdAt: number;
}

export interface CreateRoomOptions {
  hostName: string;
  backgroundId: string;
  /** Listed in "find open arenas" when true; join-by-ID only when false. */
  public: boolean;
}

export interface RoomDirectory {
  listOpenRooms(): Promise<RoomInfo[]>;
  createRoom(options: CreateRoomOptions): Promise<{ room: RoomInfo; transport: MatchTransport }>;
  joinRoom(id: RoomId): Promise<{ room: RoomInfo; transport: MatchTransport }>;
}

/** Messages on the wire. Game traffic only. */
export type NetMessage =
  | { type: "input"; slot: SlotIndex; tick: number; frame: InputFrame }
  | { type: "snapshot"; tick: number; state: MatchState }
  | { type: "ready"; slot: SlotIndex; characterId: string; name: string }
  | { type: "start"; seed: number; backgroundId: string };

export interface MatchTransport {
  readonly roomId: RoomId;
  readonly localSlot: SlotIndex;
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage) => void): () => void;
  close(): void;
}
