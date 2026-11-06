import { NextResponse } from "next/server";
import Pusher from "pusher";
import { isValidRoomId } from "@/net/roomId";

// Signaling relay only. Pusher carries the WebRTC handshake (a few small messages per match);
// once the peer-to-peer data channel is open, no game traffic goes through here.

let pusher: Pusher | null = null;
function getPusher(): Pusher | null {
  const { PUSHER_APP_ID, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_KEY || !NEXT_PUBLIC_PUSHER_CLUSTER) return null;
  pusher ??= new Pusher({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });
  return pusher;
}

const KINDS = new Set(["join", "offer", "answer", "busy", "leave"]);
const MAX_SIGNAL_BYTES = 8000; // Pusher's limit is 10 KB per event

/** POST { roomId, from, to?, kind, sdp? } -> relays to everyone subscribed to room-<id>. */
export async function POST(request: Request) {
  const p = getPusher();
  if (!p) return NextResponse.json({ error: "Pusher is not configured" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { roomId, from, to, kind, sdp } = body;
  if (typeof roomId !== "string" || !isValidRoomId(roomId)) {
    return NextResponse.json({ error: "Bad room id" }, { status: 400 });
  }
  if (typeof from !== "string" || from.length > 40 || typeof kind !== "string" || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Bad signal" }, { status: 400 });
  }
  if (to !== undefined && (typeof to !== "string" || to.length > 40)) {
    return NextResponse.json({ error: "Bad signal" }, { status: 400 });
  }
  if (sdp !== undefined && (typeof sdp !== "string" || sdp.length > MAX_SIGNAL_BYTES)) {
    return NextResponse.json({ error: "Bad signal" }, { status: 400 });
  }

  await p.trigger(`room-${roomId.toUpperCase()}`, "signal", { from, to, kind, sdp });
  return NextResponse.json({ success: true });
}

/** GET ?roomId=ABCDE -> { occupied }. A room exists while its host is subscribed to the channel. */
export async function GET(request: Request) {
  const p = getPusher();
  if (!p) return NextResponse.json({ error: "Pusher is not configured" }, { status: 500 });

  const roomId = new URL(request.url).searchParams.get("roomId") ?? "";
  if (!isValidRoomId(roomId)) return NextResponse.json({ error: "Bad room id" }, { status: 400 });

  const res = await p.get({ path: `/channels/room-${roomId.toUpperCase()}` });
  if (!res.ok) return NextResponse.json({ error: "Pusher error" }, { status: 502 });
  const info = (await res.json()) as { occupied?: boolean };
  return NextResponse.json({ occupied: Boolean(info.occupied) });
}
