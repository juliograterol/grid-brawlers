"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BACKGROUNDS } from "@/data/backgrounds";
import { CHARACTERS, getCharacter } from "@/data/characters";
import { availableCharacters, normalizePicks } from "@/data/selection";
import type { MatchConfig } from "@/game/session/config";
import { createRoom, joinRoom, type HostedRoom } from "@/net/rooms";
import { isValidRoomId } from "@/net/roomId";
import type { MatchTransport, PlayerPick } from "@/net/types";
import { DEFAULT_RULES, sanitizeRules, type GameRules } from "@/game/rules";
import RulesScreen from "./RulesScreen";
import SpritePreview from "./SpritePreview";

interface Props {
  onStart: (config: MatchConfig, transport: MatchTransport) => void;
  onBack: () => void;
}

type Phase =
  | { name: "menu" }
  | { name: "hosting"; roomId: string }
  | { name: "joining" }
  | { name: "room"; transport: MatchTransport };

export default function OnlineLobby({ onStart, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>({ name: "menu" });
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const hostedRef = useRef<HostedRoom | null>(null);
  const handedOff = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Leaving this screen without starting a match tears everything down.
  useEffect(
    () => () => {
      hostedRef.current?.cancel();
      const p = phaseRef.current;
      if (p.name === "room" && !handedOff.current) p.transport.close();
    },
    [],
  );

  const host = async () => {
    setError(null);
    setPhase({ name: "hosting", roomId: "…" });
    try {
      const room = await createRoom();
      hostedRef.current = room;
      setPhase({ name: "hosting", roomId: room.roomId });
      const transport = await room.guest;
      hostedRef.current = null;
      setPhase({ name: "room", transport });
    } catch (e) {
      if (e instanceof Error && e.message === "Cancelled.") return; // user backed out
      hostedRef.current = null;
      setError(e instanceof Error ? e.message : "Could not create the room.");
      setPhase({ name: "menu" });
    }
  };

  const cancelHosting = () => {
    hostedRef.current?.cancel();
    hostedRef.current = null;
    setPhase({ name: "menu" });
  };

  const join = async () => {
    setError(null);
    setPhase({ name: "joining" });
    try {
      const transport = await joinRoom(code);
      setPhase({ name: "room", transport });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the room.");
      setPhase({ name: "menu" });
    }
  };

  const handOff = useCallback(
    (config: MatchConfig, transport: MatchTransport) => {
      handedOff.current = true;
      onStart(config, transport);
    },
    [onStart],
  );

  if (phase.name === "room") {
    return (
      <Room
        transport={phase.transport}
        onStart={handOff}
        onLeft={(msg) => {
          phase.transport.close();
          setError(msg);
          setPhase({ name: "menu" });
        }}
        onBack={() => {
          phase.transport.close();
          onBack();
        }}
      />
    );
  }

  return (
    <main className="menu lobby">
      <h2>Online</h2>

      {phase.name === "hosting" && (
        <section className="slot-panel">
          <h3>Room code</h3>
          <p className="room-code">{phase.roomId}</p>
          <p className="hint">Share this code. Waiting for your opponent to join…</p>
          <div className="actions">
            <button className="btn ghost" onClick={cancelHosting}>Cancel</button>
          </div>
        </section>
      )}

      {phase.name === "joining" && <p className="hint">Connecting to {code.toUpperCase()}…</p>}

      {phase.name === "menu" && (
        <>
          <div className="slots">
            <section className="slot-panel">
              <h3>Host a match</h3>
              <button className="btn" onClick={host}>Create room</button>
            </section>
            <section className="slot-panel">
              <h3>Join a match</h3>
              <input
                className="name-input"
                placeholder="Room code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && isValidRoomId(code) && join()}
              />
              <button className="btn" onClick={join} disabled={!isValidRoomId(code)}>Join</button>
            </section>
          </div>
          {error && <p className="hint" role="alert">{error}</p>}
          <div className="actions">
            <button className="btn ghost" onClick={onBack}>Back</button>
          </div>
        </>
      )}
    </main>
  );
}

function Room({
  transport,
  onStart,
  onLeft,
  onBack,
}: {
  transport: MatchTransport;
  onStart: (config: MatchConfig, transport: MatchTransport) => void;
  onLeft: (message: string) => void;
  onBack: () => void;
}) {
  const isHost = transport.localSlot === 0;
  const [myChar, setMyChar] = useState(isHost ? CHARACTERS[0].id : CHARACTERS[1]?.id ?? CHARACTERS[0].id);
  const [myName, setMyName] = useState("");
  const [peer, setPeer] = useState<PlayerPick | null>(null);
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  /** Host only: START opens the rules screen; the guest keeps waiting here until "start" (with the rules) arrives. */
  const [configuring, setConfiguring] = useState(false);

  // Slot 0 (host) picks first; the guest sees what is left. Both sides compute the same result.
  const picks = useMemo(
    () => normalizePicks(CHARACTERS, isHost ? [myChar, peer?.characterId ?? null] : [peer?.characterId ?? null, myChar]),
    [isHost, myChar, peer],
  );
  const myPick = picks[transport.localSlot]!;
  const options = availableCharacters(CHARACTERS, picks, transport.localSlot);
  const myDisplayName = myName.trim() || (isHost ? "Player 1" : "Player 2");

  // Handlers read the latest values through a ref so the subscription effect does not re-run.
  const latest = useRef({ myPick, myDisplayName, backgroundId, picks, peer, onStart, onLeft });
  latest.current = { myPick, myDisplayName, backgroundId, picks, peer, onStart, onLeft };

  const announce = useCallback(() => {
    const l = latest.current;
    transport.send({ type: "ready", slot: transport.localSlot, characterId: l.myPick, name: l.myDisplayName });
  }, [transport]);

  useEffect(() => {
    let seenPeer = false;
    const offMsg = transport.onMessage((m) => {
      if (m.type === "ready" && m.slot !== transport.localSlot) {
        setPeer({ characterId: m.characterId, name: m.name });
        if (!seenPeer) {
          seenPeer = true;
          announce(); // the peer may have attached its handler after our first announcement
        }
      } else if (m.type === "start" && transport.localSlot === 1) {
        latest.current.onStart(
          {
            mode: "online",
            backgroundId: m.backgroundId,
            rules: sanitizeRules(m.rules), // the host's rules; identical on both clients
            slots: [
              { ...m.slots[0], controller: "remote" },
              { ...m.slots[1], controller: "online-local" },
            ],
          },
          transport,
        );
      }
    });
    const offClose = transport.onClose(() => latest.current.onLeft("Your opponent left the room."));
    announce();
    return () => {
      offMsg();
      offClose();
    };
  }, [transport, announce]);

  // Re-announce whenever our own choice changes.
  useEffect(() => {
    announce();
  }, [myPick, myDisplayName, announce]);

  const start = (rules: GameRules) => {
    if (!isHost || !peer) return;
    const slots: [PlayerPick, PlayerPick] = [
      { characterId: picks[0]!, name: myDisplayName },
      { characterId: picks[1]!, name: peer.name },
    ];
    transport.send({ type: "start", backgroundId, slots, rules });
    onStart(
      {
        mode: "online",
        backgroundId,
        rules,
        slots: [
          { ...slots[0], controller: "online-local" },
          { ...slots[1], controller: "remote" },
        ],
      },
      transport,
    );
  };

  if (configuring && isHost && peer) {
    return <RulesScreen onBack={() => setConfiguring(false)} onConfirm={start} />;
  }

  const opponentChar = peer ? getCharacter(picks[isHost ? 1 : 0] ?? peer.characterId) : null;

  return (
    <main className="menu lobby">
      <h2>Room {transport.roomId}</h2>

      <div className="slots">
        <section className="slot-panel">
          <h3>You ({isHost ? "host" : "guest"})</h3>
          <input
            className="name-input"
            placeholder={isHost ? "Player 1" : "Player 2"}
            maxLength={12}
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
          />
          <div className="char-grid" role="radiogroup" aria-label="Your character">
            {options.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={myPick === c.id}
                className={`char-card ${myPick === c.id ? "selected" : ""}`}
                style={{ ["--accent" as string]: c.color }}
                onClick={() => setMyChar(c.id)}
              >
                <SpritePreview def={c} height={110} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="slot-panel">
          <h3>Opponent</h3>
          {peer && opponentChar ? (
            <div className="char-grid">
              <div className="char-card selected" style={{ ["--accent" as string]: opponentChar.color }}>
                <SpritePreview def={opponentChar} height={110} />
                <span>{peer.name}</span>
              </div>
            </div>
          ) : (
            <p className="hint">Waiting for opponent…</p>
          )}
        </section>
      </div>

      {isHost && (
        <section className="bg-panel">
          <h3>Arena</h3>
          <div className="bg-grid" role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                role="radio"
                aria-checked={backgroundId === b.id}
                className={`bg-card ${backgroundId === b.id ? "selected" : ""}`}
                onClick={() => setBackgroundId(b.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.thumbnail ?? b.src} alt="" />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>Leave</button>
        {isHost ? (
          <button className="btn" onClick={() => setConfiguring(true)} disabled={!peer}>START</button>
        ) : (
          <p className="hint">Waiting for the host to start…</p>
        )}
      </div>
    </main>
  );
}
