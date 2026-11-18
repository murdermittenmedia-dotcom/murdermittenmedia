import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useReviewLiveEvents } from "@/hooks/useReviewLiveEvents";
import { normalizeTikFinityReviewEvent, type TikFinityReviewEvent } from "@shared/review-tikfinity";

export default function ReviewTikTokConnection() {
  const studio = useReviewLiveEvents();
  const utils = trpc.useUtils();
  const [roomId, setRoomId] = useState("");
  const [running, setRunning] = useState(false);
  const [localConnected, setLocalConnected] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const occurrence = useRef(studio.occurrenceId); occurrence.current = studio.occurrenceId;
  const ingest = trpc.reviewStudio.ingestTikTok.useMutation();
  const submit = useRef(ingest.mutateAsync); submit.current = ingest.mutateAsync;
  const save = trpc.reviewStudio.setSettings.useMutation({ onSuccess: () => { void utils.reviewStudio.settings.invalidate(); }, onError: (err) => setError(err.message) });
  const status = trpc.reviewStudio.status.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  useEffect(() => { setRoomId(studio.settings.tiktokRoomId ?? ""); }, [studio.settings.tiktokRoomId]);
  useEffect(() => {
    if (!running || !studio.settings.tiktokEnabled || !studio.settings.tiktokRoomId) return;
    let alive = true; let socket: WebSocket | undefined; let reconnect: ReturnType<typeof setTimeout> | undefined;
    const queue: TikFinityReviewEvent[] = []; let draining = false;
    const drain = async () => {
      if (draining || !alive) return;
      draining = true;
      while (alive && queue.length) {
        try {
          await submit.current(queue[0]); queue.shift(); setPending(queue.length);
          void utils.reviewStudio.status.invalidate();
        } catch (err: any) {
          setError(err?.message ?? "Unable to forward TikFinity event");
          if (["BAD_REQUEST", "FORBIDDEN", "CONFLICT"].includes(err?.data?.code)) { queue.shift(); setPending(queue.length); }
          else await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      draining = false;
    };
    const connect = () => {
      if (!alive) return;
      try {
        socket = new WebSocket("ws://localhost:21213/");
        socket.onopen = () => { setLocalConnected(true); setError(""); };
        socket.onmessage = (message) => {
          try {
            const event = normalizeTikFinityReviewEvent(JSON.parse(message.data), studio.settings.tiktokRoomId!, occurrence.current);
            if (event) { queue.push(event); setPending(queue.length); void drain(); }
          } catch (err: any) { setError(err.message ?? "Unverifiable TikFinity payload ignored"); }
        };
        socket.onerror = () => setError("TikFinity Desktop must be running on this computer. Allow local-network access if your browser requests it.");
        socket.onclose = () => { setLocalConnected(false); if (alive) reconnect = setTimeout(connect, 2000); };
      } catch (err: any) { setError(err.message); }
    };
    connect();
    return () => { alive = false; if (reconnect) clearTimeout(reconnect); socket?.close(); setLocalConnected(false); };
  }, [running, studio.settings.tiktokEnabled, studio.settings.tiktokRoomId, utils]);
  const connect = async () => {
    setError("");
    try { await save.mutateAsync({ tiktokEnabled: true, tiktokRoomId: roomId }); setRunning(true); } catch {}
  };
  const disconnect = async () => { setRunning(false); await save.mutateAsync({ tiktokEnabled: false }); void utils.reviewStudio.status.invalidate(); };
  return <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-white">TikTok LIVE connection <span className={`ml-2 text-[10px] ${status.data?.tiktokConnected ? "text-green-300" : "text-white/40"}`}>{status.data?.tiktokConnected ? "Real events received" : "Not verified / disconnected"}</span></summary>
    <div className="mt-4 space-y-3 text-xs text-white/55">
      <p>Use <a className="text-red-300 underline" href="https://tikfinity.zerody.one/tiktok/dapi" target="_blank" rel="noopener noreferrer">TikFinity Desktop</a> on your streaming computer, connected to your actual TikTok LIVE account. Keep this admin window open. No stream key goes in any overlay URL.</p>
      <label className="block">Actual TikTok LIVE room ID<input value={roomId} onChange={(event) => setRoomId(event.target.value.trim())} inputMode="numeric" placeholder="Numeric live room ID from TikFinity" disabled={running} className="mt-1 block w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white disabled:opacity-40" /></label>
      <div className="flex gap-2"><button type="button" disabled={save.isPending || !/^\d{5,30}$/.test(roomId)} onClick={() => void (running ? disconnect() : connect())} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-40">{running ? "Disconnect TikFinity" : "Connect local TikFinity"}</button><span className="self-center text-[10px]">{localConnected ? "Local event socket open" : "Local event socket closed"}{pending ? ` · ${pending} awaiting delivery` : ""}</span></div>
      {error && <p role="alert" className="rounded-lg border border-amber-400/25 p-2 text-amber-200">{error}</p>}
      <p>Only exact FIRE/TRASH comments or their emoji count. One vote per TikTok account per song; changes replace the previous vote. Accounts stay separate from website users unless verifiably linked.</p>
      <p className="text-amber-200/80">Native TikTok polls remain separate: individual native-poll voter identities are not verified, so their totals are never added to this scoreboard.</p>
    </div>
  </details>;
}
