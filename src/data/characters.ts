import type { CharacterDef } from "./types";

const medievalRed: CharacterDef = {
  id: "medieval-red",
  name: "Red Knight",
  color: "red",
  basePath: "/assets/characters/medieval-red/",
  scale: 2.5,
  drawOffset: { x: 150, y: 110 },
  body: { width: 80, height: 130 },
  damage: 0.25,
  // offsetLeft mirrors offsetRight around the body: body.width - box.width - offsetRight (80 - 160 - 0).
  attackBox: { width: 160, height: 50, offsetRight: 0, offsetLeft: -80 },
  sprites: {
    idle: { src: "idle.png", frames: 8 },
    run: { src: "run.png", frames: 8, left: true },
    jump: { src: "jump.png", frames: 2, left: true },
    hit: { src: "hit.png", frames: 4 },
    death: { src: "death.png", frames: 6 },
    attack1: { src: "attack1.png", frames: 4, left: true },
    // Remove these two entries and the combo falls back to attack1 for every step.
    attack2: { src: "attack2.png", frames: 4 },
    attack3: { src: "attack3.png", frames: 4 },
  },
  sounds: { hit: "hitSound1", death: "swordDeath1" },
};

const medievalBlue: CharacterDef = {
  id: "medieval-blue",
  name: "Blue Knight",
  color: "blue",
  basePath: "/assets/characters/medieval-blue/",
  scale: 2.8,
  drawOffset: { x: 150, y: 110 },
  body: { width: 80, height: 130 },
  damage: 0.25,
  // offsetLeft mirrors offsetRight around the body: body.width - box.width - offsetRight (80 - 160 - 0).
  attackBox: { width: 160, height: 50, offsetRight: 0, offsetLeft: -80 },
  sprites: {
    idle: { src: "idle.png", frames: 10 },
    run: { src: "run.png", frames: 6, left: true },
    jump: { src: "jump.png", frames: 2, left: true },
    hit: { src: "hit.png", frames: 3 },
    death: { src: "death.png", frames: 9 },
    attack1: { src: "attack1.png", frames: 4, left: true },
    attack2: { src: "attack2.png", frames: 4 },
    attack3: { src: "attack3.png", frames: 5 },
  },
  sounds: { hit: "hitSound2", death: "swordDeath2" },
};

/** Registry order = order shown in the character menu. */
export const CHARACTERS: readonly CharacterDef[] = [medievalRed, medievalBlue];

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): CharacterDef {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown character "${id}"`);
  return def;
}
