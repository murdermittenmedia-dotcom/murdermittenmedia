import { useEffect, useRef, useState } from "react";
import { Flame, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type CurrentVoteTrack = { id: number; artistName: string; songTitle: string; reviewOccurrenceId?: string | null };
type VoteRequest = { submissionId: number; occurrenceId: string; reaction: "fire" | "trash"; amount: number; requestId: string };
export function parseAdminVoteAmount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/** Mounted only by the role-protected admin control board. No client-side
 * fabricated voter identities or local-only totals enter the live feed. */
export function ReviewAdminVotes({ song, isLive }: { song: CurrentVoteTrack | null; isLive: boolean }) {
  const [amountText, setAmountText] = useState("1");
  const [retry, setRetry] = useState<VoteRequest | null>(null);
  const inFlight = useRef(false);
  const trackRef = useRef(song); trackRef.current = song;
  const utils = trpc.useUtils();
  const reactions = trpc.queue.getReactions.useQuery({ submissionId: song?.id ?? 0 }, {
    enabled: !!song, refetchInterval: 2_000, refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, refetchOnReconnect: true,
  });
  const counts = reactions.data;
  const occurrenceId = song?.reviewOccurrenceId ?? (counts && "occurrenceId" in counts ? counts.occurrenceId : null);
  const amount = parseAdminVoteAmount(amountText);
  const addVotes = trpc.reviewStudio.addVotes.useMutation({
    onSuccess: (result, request) => {
      inFlight.current = false;
      setRetry(null);
      void utils.queue.getReactions.invalidate({ submissionId: request.submissionId });
      void utils.queue.getAll.invalidate();
      void utils.queue.getReviewed.invalidate();
      toast.success(result.duplicate ? "Vote addition already applied — totals refreshed" : `Added ${request.amount.toLocaleString()} ${request.reaction === "fire" ? "Fire" : "Trash"} votes`);
    },
    onError: (error, request) => {
      inFlight.current = false;
      const sameTrack = trackRef.current?.id === request.submissionId && trackRef.current?.reviewOccurrenceId === request.occurrenceId;
      const permanent = ["CONFLICT", "BAD_REQUEST", "FORBIDDEN", "UNAUTHORIZED"].includes(error.data?.code ?? "");
      setRetry(sameTrack && !permanent && request.occurrenceId ? { ...request, occurrenceId: request.occurrenceId } : null);
      toast.error(error.message);
    },
  });
  useEffect(() => { setRetry(null); }, [song?.id, song?.reviewOccurrenceId]);
  const available = !!song && isLive && !!occurrenceId;
  const disabled = !available || amount === null || addVotes.isPending;
  function send(reaction: "fire" | "trash", previous?: VoteRequest) {
    if (inFlight.current || addVotes.isPending || !song || !isLive || !occurrenceId || (!previous && amount === null)) return;
    if (previous && (previous.submissionId !== song.id || previous.occurrenceId !== occurrenceId)) {
      setRetry(null); toast.error("The song changed. Add votes to the current song instead."); return;
    }
    inFlight.current = true;
    setRetry(null);
    addVotes.mutate(previous ?? { submissionId: song.id, occurrenceId, reaction, amount: amount!, requestId: crypto.randomUUID() });
  }
  const addedFire = counts && "adminFire" in counts ? counts.adminFire : 0;
  const addedTrash = counts && "adminTrash" in counts ? counts.adminTrash : 0;
  return <section className="rounded-xl border border-orange-400/25 bg-white/[0.03] p-4" aria-busy={addVotes.isPending}>
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-200">Admin vote controls</p><h2 className="mt-1 font-['Anton'] text-xl uppercase text-white">Add Fire / Trash votes</h2></div>
      <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase text-white/40">Admin only</span>
    </div>
    <p className="mt-2 text-[11px] leading-relaxed text-white/45">Enter any positive whole number. Additions apply only to the current song and sync to viewers and OBS.</p>
    <div className="mt-3 grid grid-cols-2 gap-2" aria-live="polite">
      <div className="rounded-lg border border-orange-400/20 bg-orange-400/[0.06] px-3 py-2"><span className="text-[10px] font-bold uppercase text-orange-200">Fire total</span><p className="mt-1 text-xl font-black text-white">{song ? (counts?.fire ?? 0).toLocaleString() : "—"}</p><p className="text-[10px] text-white/40">{Number(addedFire).toLocaleString()} admin-added</p></div>
      <div className="rounded-lg border border-blue-400/20 bg-blue-400/[0.06] px-3 py-2"><span className="text-[10px] font-bold uppercase text-blue-200">Trash total</span><p className="mt-1 text-xl font-black text-white">{song ? (counts?.trash ?? 0).toLocaleString() : "—"}</p><p className="text-[10px] text-white/40">{Number(addedTrash).toLocaleString()} admin-added</p></div>
    </div>
    <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-white/55" htmlFor="admin-vote-amount">Votes to add</label>
    <input id="admin-vote-amount" type="text" inputMode="numeric" pattern="[0-9]*" value={amountText} onChange={(event) => setAmountText(event.target.value)} disabled={addVotes.isPending} aria-invalid={amount === null} className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-base text-white outline-none focus:border-orange-300/70 disabled:opacity-40" />
    <div className="mt-2 grid grid-cols-4 gap-2">{[1, 10, 100, 1000].map((value) => <button type="button" key={value} disabled={addVotes.isPending} onClick={() => setAmountText(String(value))} className="min-h-9 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-bold text-white/60 hover:border-white/30 disabled:opacity-40">{value.toLocaleString()}</button>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" disabled={disabled} onClick={() => send("fire")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-orange-400/35 bg-orange-400/15 px-3 py-2.5 text-xs font-black uppercase text-orange-200 hover:bg-orange-400/25 disabled:opacity-35"><Flame className="h-4 w-4" />Add Fire</button>
      <button type="button" disabled={disabled} onClick={() => send("trash")} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-400/35 bg-blue-400/15 px-3 py-2.5 text-xs font-black uppercase text-blue-200 hover:bg-blue-400/25 disabled:opacity-35"><Trash2 className="h-4 w-4" />Add Trash</button>
    </div>
    {amount === null && <p role="alert" className="mt-2 text-xs text-red-300">Enter a positive whole number within the supported safe numeric range.</p>}
    {!available && <p className="mt-2 text-[11px] text-white/40">Go live and play a song to enable vote additions.</p>}
    {retry && <button type="button" disabled={addVotes.isPending || !available} onClick={() => send(retry.reaction, retry)} className="mt-3 text-xs text-amber-200 underline disabled:opacity-40">Retry the same addition safely</button>}
  </section>;
}
