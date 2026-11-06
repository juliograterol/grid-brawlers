# Grid Brawlers

Next.js (App Router) + TypeScript port of the canvas sword-fighting game.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Controls
- Local multiplayer: P1 `A`/`D`/`W` + `F`, P2 `←`/`→`/`↑` + `0`.
- Single player: `A`/`D`/`W` to move, **mouse click** (or tap / on-screen button) to attack. `F` does nothing.
- `Esc` returns to the menu.

## Adding content
- **Character**: add a folder under `public/assets/characters/<id>/`, add a `CharacterDef` to `src/data/characters.ts`
  and append it to `CHARACTERS`. `attack2`/`attack3` and `left: true` sheets are optional.
- **Background**: drop the image in `public/assets/backgrounds/` and add an entry to `src/data/backgrounds.ts`.

## Layout
- `src/data` registries + sprite resolution (pure data)
- `src/game/sim.ts` deterministic 60 Hz simulation (no DOM)
- `src/game/input` input sources (keyboard, pointer, touch, AI, remote)
- `src/game/session` how a match is assembled (`LocalSession`) and who controls each slot
- `src/game/render` canvas renderer; `src/game/createGame.ts` wires everything together
- `src/net` online types (rooms, transport) - interfaces only
- `src/components` React menus and the canvas host

## Online play (WebRTC + Pusher)
1. Create a free Channels app at pusher.com and copy `.env.example` to `.env.local` with its credentials.
2. `npm run dev`; open the game in two browsers, **Online** -> one creates a room, the other joins with the 5-letter code.

Pusher is only the signaling relay (`/api/room`, a handful of messages per match). After the handshake the browsers talk
directly over WebRTC data channels. The host (slot 0) runs the simulation; the guest sends inputs and renders snapshots.
Code: `src/net` (signaling, rooms, transport) and `src/game/session/onlineSessions.ts`.
STUN only (no TURN): players behind strict/symmetric NATs may be unable to connect.
