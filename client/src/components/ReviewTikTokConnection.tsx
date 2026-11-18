import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Galaxy = inferRouterOutputs<AppRouter>["reviewBridge"]["galaxies"][number];
function GalaxyApproval({ gift, refresh }: { gift: Galaxy; refresh: () => void }) {
  const [target, setTarget] = useState(gift.candidates.length === 1 ? String(gift.candidates[0].id) : "");
  const [reconcile, setReconcile] = useState(false); const [note, setNote] = useState("");
  const queue = trpc.queue.getAll.useQuery(undefined, { enabled: reconcile });
  const approve = trpc.reviewBridge.approveGalaxy.useMutation({ onSuccess: () => { toast.success("Galaxy priority confirmed; current review unchanged."); refresh(); }, onError: error => toast.error(error.message) });
  const decline = trpc.reviewBridge.declineGalaxy.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const options = reconcile ? queue.data?.submissions.filter(song => song.status === "pending") ?? [] : gift.candidates;
  return <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
    <div className="flex flex-wrap justify-between gap-2"><strong className="text-white">{gift.actor} · Galaxy {gift.unit}</strong><span>{gift.status.replaceAll("_", " ")}</span></div>
    <p>{new Date(gift.receivedAtMs).toLocaleString()}{gift.auditNote ? ` · ${gift.auditNote}` : ""}</p>
    {gift.status === "awaiting_admin" && <>
      <p>{gift.candidates.length ? "A one-time TikTok link matched this artist. Confirm the actual gift before granting priority." : "No matching song is linked. Nothing has moved in the queue."}</p>
      <label className="block">Target waiting song<select aria-label="Galaxy target song" value={target} onChange={event => setTarget(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-[#101010] p-2 text-white"><option value="">Choose a verified song</option>{options.map(song => <option key={song.id} value={song.id}>{song.artistName} — {song.songTitle}</option>)}</select></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={reconcile} onChange={event => { setReconcile(event.target.checked); setTarget(""); }} /><span>Admin reconciliation: I independently verified this viewer owns the selected submission.</span></label>
      <input aria-label="Galaxy audit reason" value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder={reconcile ? "Required audit reason (at least 8 characters)" : "Optional confirmation note"} className="w-full rounded-lg border border-white/15 bg-black/30 p-2 text-white" />
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!target || approve.isPending || reconcile && note.trim().length < 8} onClick={() => approve.mutate({ redemptionId: gift.id, submissionId: Number(target), reconcile, note })} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-40">Confirm Galaxy priority</button><button type="button" disabled={decline.isPending || note.trim().length < 3} onClick={() => decline.mutate({ redemptionId: gift.id, note })} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40">Decline with reason</button></div>
    </>}
  </div>;
}

export default function ReviewTikTokConnection() {
  const utils = trpc.useUtils();
  const status = trpc.reviewBridge.status.useQuery(undefined, { refetchInterval: 5_000, refetchIntervalInBackground: true });
  const [open, setOpen] = useState(false); const [roomId, setRoomId] = useState("");
  const [pairing, setPairing] = useState<{ pairingCode: string; expiresAtMs: number } | null>(null);
  const [fire, setFire] = useState("!fire"); const [trash, setTrash] = useState("!trash"); const [galaxyId, setGalaxyId] = useState("");
  const device = status.data?.find(item => item.enabled && item.paired) ?? status.data?.find(item => item.enabled);
  const diagnostics = trpc.reviewBridge.diagnostics.useQuery(undefined, { enabled: open, refetchInterval: open ? 5_000 : false });
  const galaxies = trpc.reviewBridge.galaxies.useQuery(undefined, { enabled: open, refetchInterval: open ? 5_000 : false });
  const refresh = () => { void utils.reviewBridge.invalidate(); void utils.queue.getAll.invalidate(); };
  const pair = trpc.reviewBridge.createPairing.useMutation({ onSuccess: value => { setPairing(value); refresh(); }, onError: error => toast.error(error.message) });
  const configure = trpc.reviewBridge.configure.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const revoke = trpc.reviewBridge.revoke.useMutation({ onSuccess: () => { setPairing(null); refresh(); }, onError: error => toast.error(error.message) });
  useEffect(() => { if (!device) return; setRoomId(device.roomId); setFire(device.fireCommand); setTrash(device.trashCommand); setGalaxyId(device.galaxyGiftId ?? ""); }, [device?.bridgeId, device?.roomId, device?.fireCommand, device?.trashCommand, device?.galaxyGiftId]);
  useEffect(() => { if (!pairing) return; const timer = setTimeout(() => setPairing(null), Math.max(0, pairing.expiresAtMs - Date.now())); return () => clearTimeout(timer); }, [pairing]);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-white">TikFinity bridge <span className="ml-2 text-[10px] text-white/60">{status.isError ? "Status unavailable" : device?.state ?? "Not Configured"}</span></summary>
    <div className="mt-4 space-y-4 text-xs leading-relaxed text-white/65">
      <p>The connector runs on your Windows streaming PC and sends signed HTTPS events here. No browser or hosted server connects to your localhost, and no port forwarding is needed.</p>
      <div className="space-y-2"><label className="block">Actual TikTok LIVE room ID<input value={roomId} onChange={event => setRoomId(event.target.value.trim())} inputMode="numeric" placeholder="Actual numeric room ID from TikFinity LIVE events" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-2 text-white" /></label>
        <button type="button" disabled={pair.isPending || !/^\d{5,30}$/.test(roomId)} onClick={() => pair.mutate({ roomId, deviceLabel: "Windows streaming PC" })} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-40">Generate 5-minute pairing code</button>
        {pairing && <div className="rounded-lg border border-red-500/30 p-3"><p>Paste this once into <code>node bridge.mjs pair</code> on your PC. Never put it into an overlay URL.</p><code className="mt-2 block break-all text-white">{pairing.pairingCode}</code><button type="button" onClick={() => navigator.clipboard.writeText(pairing.pairingCode).then(() => toast.success("Pairing code copied"), () => toast.error("Clipboard permission required"))} className="mt-2 rounded border border-white/20 px-3 py-2">Copy code</button></div>}
        <p>No actual LIVE room yet? Keep the bridge unconfigured until a real room/event can be inspected. Connected does not mean a Galaxy reward was live-tested.</p>
      </div>
      {device?.paired && <div className="space-y-3 border-t border-white/10 pt-3">
        <div className="grid grid-cols-2 gap-2"><label>FIRE command<input value={fire} onChange={event => setFire(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/30 p-2 text-white" /></label><label>TRASH command<input value={trash} onChange={event => setTrash(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/30 p-2 text-white" /></label></div>
        <label className="block">Verified Galaxy gift ID<input value={galaxyId} onChange={event => setGalaxyId(event.target.value.trim())} inputMode="numeric" placeholder="Copy the actual Galaxy ID from diagnostics; never guess" className="mt-1 w-full rounded border border-white/15 bg-black/30 p-2 text-white" /></label>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={configure.isPending} onClick={() => configure.mutate({ bridgeId: device.bridgeId, roomId, fireCommand: fire, trashCommand: trash, galaxyGiftId: galaxyId || null })} className="rounded-lg border border-white/20 px-3 py-2">Save bridge settings</button><button type="button" disabled={configure.isPending} onClick={() => configure.mutate({ bridgeId: device.bridgeId, testMode: !device.testMode })} className="rounded-lg border border-white/20 px-3 py-2">{device.testMode ? "Exit isolated Test Mode" : "Enter isolated Test Mode"}</button><button type="button" disabled={configure.isPending} onClick={() => configure.mutate({ bridgeId: device.bridgeId, newStream: true })} className="rounded-lg border border-white/20 px-3 py-2">Close/reset bridge stream</button><button type="button" onClick={() => revoke.mutate({ bridgeId: device.bridgeId })} className="rounded-lg border border-red-400/30 px-3 py-2 text-red-300">Revoke connector</button></div>
        <p>Switching live/test mode or closing a stream invalidates old link codes and reward context. Keep the connector running; the admin browser need not stay open.</p>
      </div>}
      <p className="rounded-lg border border-amber-400/25 p-3 text-amber-200">Live Verification Pending. One vote per reliable TikTok viewer per review occurrence; changing a command vote replaces the previous choice. Website identities and native TikTok polls remain separate. Galaxy moves require your confirmation.</p>
      <details><summary className="cursor-pointer font-bold text-white">Galaxy requests / reconciliation ({galaxies.data?.filter(gift => gift.status === "awaiting_admin").length ?? 0})</summary><div className="mt-3 max-h-[500px] space-y-3 overflow-y-auto">{galaxies.data?.map(gift => <GalaxyApproval key={gift.id} gift={gift} refresh={refresh} />)}{galaxies.data?.length === 0 && <p>No Galaxy receipts received. Never choose a random artist for an unmatched gift.</p>}</div></details>
      <details><summary className="cursor-pointer font-bold text-white">Redacted event diagnostics · 7-day retention</summary><ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">{diagnostics.data?.map(item => <li key={item.id} className="rounded border border-white/10 p-2">{item.testMode ? "SIMULATED · " : ""}{item.eventKind} {item.giftName ? `· ${item.giftName} (${item.giftId})` : ""} · {item.outcome.replaceAll("_", " ")} · {new Date(item.timestampMs).toLocaleTimeString()}</li>)}</ul></details>
      <p>TikFinity alone owns viewer gift/follow sounds and your existing all-viewer TTS. The website does not overwrite its filters, voice, points settings, or add a follow cooldown. Capture TikFinity application audio exactly once; keep V1 visual browser sources silent and the admin manual soundboard separate.</p>
      <p>Desktop free capacity is documented as five sound alerts and limited TTS. With six desired triggers, keep Corn, Tomato, Fire, Galaxy and Follow; keep Heart Me only through a supported shared rule/free capacity, otherwise as silent support. No Pro purchase or sound mapping changes were made.</p>
    </div>
  </details>;
}
