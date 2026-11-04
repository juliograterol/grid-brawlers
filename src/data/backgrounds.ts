import type { BackgroundDef } from "./types";

/** Registry order = order shown in the background menu. */
export const BACKGROUNDS: readonly BackgroundDef[] = [
  {
    id: "fight-zone",
    name: "Fight Zone",
    src: "/assets/backgrounds/fight-zone.gif",
  },
];

const byId = new Map(BACKGROUNDS.map((b) => [b.id, b]));

export function getBackground(id: string): BackgroundDef {
  return byId.get(id) ?? BACKGROUNDS[0];
}
