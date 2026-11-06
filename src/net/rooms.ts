// Room create/join. Handshake (non-trickle ICE, so it is exactly one offer and one answer):
//   guest: join  ->  host: offer  ->  guest: answer   (all relayed by Pusher via /api/room)
// then the data channels open, the Pusher connection is closed, and everything else is peer-to-peer.

import { generateRoomId, isValidRoomId } from "./roomId";
import { roomExists, Signaling, type Signal } from "./signaling";
import { RtcTransport } from "./transport";
import type { MatchTransport } from "./types";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
const HANDSHAKE_TIMEOUT_MS = 15000;

/** Log connection progress to the console so failed connections can be diagnosed. */
function newPeer(label: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  pc.addEventListener("iceconnectionstatechange", () => console.info(`[rtc ${label}] ice: ${pc.iceConnectionState}`));
  pc.addEventListener("connectionstatechange", () => console.info(`[rtc ${label}] conn: ${pc.connectionState}`));
  pc.addEventListener("icecandidateerror", (e) => console.info(`[rtc ${label}] ice error`, (e as RTCPeerConnectionIceErrorEvent).errorText));
  return pc;
}

function describeCandidates(sdp: string): string {
  const types = [...sdp.matchAll(/typ (host|srflx|relay)/g)].map((m) => m[1]);
  return `candidates: ${types.length ? types.join(",") : "none"}`;
}

function gatheringDone(pc: RTCPeerConnection, maxMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const timer = setTimeout(done, maxMs); // use whatever candidates we have by then
    pc.addEventListener("icegatheringstatechange", check);
  });
}

function timeout<T>(p: Promise<T>, ms: number, message: string | (() => string)): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(typeof message === "function" ? message() : message)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

function channelOpen(ch: RTCDataChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ch.readyState === "open") return resolve();
    ch.addEventListener("open", () => resolve(), { once: true });
    ch.addEventListener("close", () => reject(new Error("Connection closed.")), { once: true });
  });
}

export interface HostedRoom {
  roomId: string;
  /** Resolves with the transport once a guest has connected. Rejects only if cancelled. */
  guest: Promise<MatchTransport>;
  cancel(): void;
}

export async function createRoom(): Promise<HostedRoom> {
  let roomId = "";
  for (let i = 0; i < 5 && !roomId; i++) {
    const candidate = generateRoomId();
    if (!(await roomExists(candidate))) roomId = candidate;
  }
  if (!roomId) throw new Error("Could not find a free room code. Try again.");

  const signaling = new Signaling(roomId);
  await signaling.connect();

  let cancelled = false;
  let busyWith: string | null = null;
  let current: { pc: RTCPeerConnection; answer: (sdp: string) => void } | null = null;
  let resolveGuest!: (t: MatchTransport) => void;
  let rejectGuest!: (e: Error) => void;
  const guest = new Promise<MatchTransport>((res, rej) => {
    resolveGuest = res;
    rejectGuest = rej;
  });
  guest.catch(() => {});

  const negotiate = async (guestId: string): Promise<MatchTransport> => {
    const pc = newPeer("host");
    try {
      const ctl = pc.createDataChannel("ctl");
      const state = pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 });
      const answerSdp = new Promise<string>((resolve) => {
        current = { pc, answer: resolve };
      });

      await pc.setLocalDescription(await pc.createOffer());
      await gatheringDone(pc);
      console.info("[rtc host] sending offer,", describeCandidates(pc.localDescription!.sdp));
      await signaling.send("offer", { to: guestId, sdp: pc.localDescription!.sdp });

      const sdp = await timeout(answerSdp, HANDSHAKE_TIMEOUT_MS, "Guest did not answer.");
      await pc.setRemoteDescription({ type: "answer", sdp });
      await timeout(Promise.all([channelOpen(ctl), channelOpen(state)]), HANDSHAKE_TIMEOUT_MS, "Could not connect.");
      return new RtcTransport(roomId, 0, pc, ctl, state);
    } catch (e) {
      pc.close();
      throw e;
    } finally {
      current = null;
    }
  };

  signaling.onSignal((s: Signal) => {
    if (cancelled) return;
    if (s.kind === "join") {
      if (busyWith) {
        if (s.from !== busyWith) void signaling.send("busy", { to: s.from }).catch(() => {});
        return;
      }
      busyWith = s.from;
      negotiate(s.from).then(
        (transport) => {
          signaling.close(); // handshake done: from here on it is direct peer-to-peer
          resolveGuest(transport);
        },
        () => {
          busyWith = null; // that guest failed; keep the room open for the next one
        },
      );
    } else if (s.kind === "answer" && s.from === busyWith && s.sdp) {
      current?.answer(s.sdp);
    } else if (s.kind === "leave" && s.from === busyWith) {
      current?.pc.close(); // guest gave up mid-handshake
    }
  });

  return {
    roomId,
    guest,
    cancel() {
      cancelled = true;
      current?.pc.close();
      signaling.close();
      rejectGuest(new Error("Cancelled."));
    },
  };
}

export async function joinRoom(rawId: string): Promise<MatchTransport> {
  const roomId = rawId.trim().toUpperCase();
  if (!isValidRoomId(roomId)) throw new Error("That is not a valid room code.");
  if (!(await roomExists(roomId))) throw new Error("Room not found. Check the code and try again.");

  const signaling = new Signaling(roomId);
  const pc = newPeer("guest");
  try {
    await signaling.connect();

    const channels: Partial<Record<string, RTCDataChannel>> = {};
    const bothChannels = new Promise<void>((resolve) => {
      pc.ondatachannel = (e) => {
        channels[e.channel.label] = e.channel;
        if (channels.ctl && channels.state) resolve();
      };
    });

    const offer = new Promise<string>((resolve, reject) => {
      signaling.onSignal((s) => {
        if (s.kind === "offer" && s.sdp) resolve(s.sdp);
        else if (s.kind === "busy") reject(new Error("That room already has two players."));
      });
    });
    await signaling.send("join");
    const sdp = await timeout(offer, HANDSHAKE_TIMEOUT_MS, "The host did not respond.");

    await pc.setRemoteDescription({ type: "offer", sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gatheringDone(pc);
    console.info("[rtc guest] sending answer,", describeCandidates(pc.localDescription!.sdp));
    await signaling.send("answer", { sdp: pc.localDescription!.sdp });

    const fail = () =>
      `Could not connect to the host (${pc.iceConnectionState}). Your network may be blocking peer-to-peer; see the browser console.`;
    await timeout(bothChannels, HANDSHAKE_TIMEOUT_MS, fail);
    await timeout(Promise.all([channelOpen(channels.ctl!), channelOpen(channels.state!)]), HANDSHAKE_TIMEOUT_MS, fail);
    signaling.close();
    return new RtcTransport(roomId, 1, pc, channels.ctl!, channels.state!);
  } catch (e) {
    void signaling.send("leave").catch(() => {});
    pc.close();
    signaling.close();
    throw e;
  }
}
