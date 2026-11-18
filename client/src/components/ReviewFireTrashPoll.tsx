import { toast } from "sonner";

export function FireTrashPoll({
  submissionId,
  songTitle,
  artistName,
  artistUserId,
  fireCount,
  trashCount,
  myReaction,
  onVote,
  isPending,
  user,
  isJudge,
}: {
  submissionId: number;
  songTitle: string;
  artistName: string;
  artistUserId?: number | null;
  fireCount: number;
  trashCount: number;
  myReaction: string | null;
  onVote: (reaction: "fire" | "trash") => void;
  isPending: boolean;
  user: { id: number; role?: string } | null;
  isJudge: boolean;
}) {
  const total = fireCount + trashCount;
  const firePct = total > 0 ? Math.round((fireCount / total) * 100) : 50;
  const trashPct = total > 0 ? 100 - firePct : 50;
  const isAdmin = user?.role === "admin";
  const selectedFire = !isAdmin && myReaction === "fire";
  const selectedTrash = !isAdmin && myReaction === "trash";
  const hasVoted = !isAdmin && !!myReaction;

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <div>
          <span className="text-white/70 text-[10px] uppercase tracking-[0.2em] font-semibold">Crowd Reaction · FIRE / TRASH</span>
          <span className="mt-0.5 block text-[9px] text-white/30">Mitten Panel voices are shown separately above</span>
        </div>
        {isAdmin && <span className="text-[10px] font-semibold text-red-300">Admin · +1 per tap</span>}
        {hasVoted && (
          <span className="text-[10px] font-semibold">
            {selectedFire ? <span className="text-orange-400">🔥 {isJudge ? "Mitten Panel voted Fire" : "You voted Fire"}</span> : <span className="text-blue-400">🗑️ {isJudge ? "Mitten Panel voted Trash" : "You voted Trash"}</span>}
          </span>
        )}
      </div>

      {/* Vote buttons */}
      <div className="grid grid-cols-2 divide-x divide-white/10">
        <button
          type="button"
          onClick={() => {
            if (!user) { toast.error("Login to vote"); return; }
            if (selectedFire) return;
            onVote("fire");
          }}
          disabled={!isAdmin && (selectedFire || isPending)}
          className={`group flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200 ${
            selectedFire ? "bg-orange-500/20 cursor-default" :
            "hover:bg-orange-500/10 active:bg-orange-500/20 cursor-pointer"
          }`}
        >
          <span className={`text-5xl transition-transform duration-200 select-none ${
            selectedFire ? "scale-110" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
          }`}>🔥</span>
          <div className="text-center">
            <div className={`font-['Anton'] text-2xl transition-colors ${
              selectedFire ? "text-orange-300" : "text-orange-400 group-hover:text-orange-300"
            }`}>FIRE</div>
            <div className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">This a banger</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!user) { toast.error("Login to vote"); return; }
            if (selectedTrash) return;
            onVote("trash");
          }}
          disabled={!isAdmin && (selectedTrash || isPending)}
          className={`group flex flex-col items-center justify-center gap-2 py-8 transition-all duration-200 ${
            selectedTrash ? "bg-blue-500/20 cursor-default" :
            "hover:bg-blue-500/10 active:bg-blue-500/20 cursor-pointer"
          }`}
        >
          <span className={`text-5xl transition-transform duration-200 select-none ${
            selectedTrash ? "scale-110" : hasVoted ? "" : "group-hover:scale-125 group-active:scale-110"
          }`}>🗑️</span>
          <div className="text-center">
            <div className={`font-['Anton'] text-2xl transition-colors ${
              selectedTrash ? "text-blue-300" : "text-blue-400 group-hover:text-blue-300"
            }`}>TRASH</div>
            <div className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">Next track please</div>
          </div>
        </button>
      </div>

      {/* Live results bar */}
      <div className="border-t border-white/10">
        <div className="flex">
          <div className="h-1.5 bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700 rounded-bl-xl" style={{ width: `${firePct}%` }} />
          <div className="h-1.5 bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-700 rounded-br-xl" style={{ width: `${trashPct}%` }} />
        </div>
        <div className="flex justify-between px-4 py-2 text-[10px]">
          <span className="text-orange-400 font-bold">🔥 {fireCount} ({firePct}%)</span>
          <span className="text-white/30">{total} vote{total !== 1 ? "s" : ""}</span>
          <span className="text-blue-400 font-bold">{trashPct}% ({trashCount}) 🗑️</span>
        </div>
      </div>
    </div>
  );
}
