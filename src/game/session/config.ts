export type GameMode = "single" | "local" | "online";

/**
 * Who drives a slot. This is the single switch point between local and online play:
 * an online room just configures one slot as "remote" and the other as a local controller.
 */
export type Controller =
  | "keyboard-p1" // A/D/W + F (local multiplayer, player 1)
  | "keyboard-p2" // arrows + 0 (local multiplayer, player 2)
  | "solo-p1" // A/D/W + mouse/tap to attack (single player)
  | "online-local" // A/D/W + F, mouse/tap to attack too (the local player in an online match)
  | "ai"
  | "remote"; // the other player in an online match

export interface SlotConfig {
  characterId: string;
  name: string;
  controller: Controller;
}

export interface MatchConfig {
  mode: GameMode;
  backgroundId: string;
  slots: [SlotConfig, SlotConfig];
}
