/* ============================================================
   MURDER MITTEN MEDIA — Fire or Trash
   Swipe game: swipe right = 🔥 FIRE, swipe left = 🗑️ TRASH
   Mobile touch swipe + desktop keyboard (→ = fire, ← = trash)
   Stats linked to user account
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { Flame, Trash2, BarChart2, Trophy, LogIn, RefreshCw, Music } from "lucide-react";

type Submission = {
  id: number;
  artistName: string;
  songTitle: string;
  youtubeUrl: string | null;
  fileUrl: string | null;
  fireCount: number;
  trashCount: number;
};

function extractYouTubeId(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)(\w[\w-]{10})/)?.[1] ?? null;
}

function SwipeCard({
  submission,
  onFire,
  onTrash,
  isTop,
  offset,
}: {
  submission: Submission;
  onFire: () => void;
  onTrash: () => void;
  isTop: boolean;
  offset: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exiting, setExiting] = useState<"fire" | "trash" | null>(null);

  const ytId = submission.youtubeUrl ? extractYouTubeId(submission.youtubeUrl) : null;
  const totalVotes = submission.fireCount + submission.trashCount;
  const firePercent = totalVotes > 0 ? Math.round((submission.fireCount / totalVotes) * 100) : 50;

  const triggerExit = useCallback((dir: "fire" | "trash") => {
    setExiting(dir);
    setTimeout(() => {
      if (dir === "fire") onFire();
      else onTrash();
    }, 350);
  }, [onFire, onTrash]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isTop) return;
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTop || startXRef.current === null) return;
    setDragX(e.touches[0].clientX - startXRef.current);
  };
  const handleTouchEnd = () => {
    if (!isTop) return;
    setIsDragging(false);
    if (dragX > 80) triggerExit("fire");
    else if (dragX < -80) triggerExit("trash");
    else setDragX(0);
    startXRef.current = null;
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isTop) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || startXRef.current === null) return;
    setDragX(e.clientX - startXRef.current);
  }, [isDragging]);
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > 80) triggerExit("fire");
    else if (dragX < -80) triggerExit("trash");
    else setDragX(0);
    startXRef.current = null;
  }, [isDragging, dragX, triggerExit]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const rotation = exiting === "fire" ? 30 : exiting === "trash" ? -30 : (dragX / 15);
  const translateX = exiting === "fire" ? 600 : exiting === "trash" ? -600 : dragX;
  const scale = isTop ? 1 : 0.95 - offset * 0.03;
  const translateY = isTop ? 0 : offset * 8;
  const opacity = exiting ? 0 : 1;

  const fireOverlay = isTop && (dragX > 30 || exiting === "fire");
  const trashOverlay = isTop && (dragX < -30 || exiting === "trash");

  return (
    <div
      ref={cardRef}
      className={`absolute inset-0 select-none ${isTop ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        transform: `translateX(${translateX}px) rotate(${rotation}deg) scale(${scale}) translateY(${translateY}px)`,
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.35s ease",
        opacity,
        zIndex: isTop ? 10 : 5 - offset,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      <div className="w-full h-full bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Fire overlay */}
        {fireOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-orange-600/40 to-red-600/40 rounded-2xl">
            <div className="border-4 border-orange-400 rounded-xl px-8 py-4 rotate-[-15deg]">
              <span className="text-orange-400 font-black text-5xl tracking-widest">🔥 FIRE</span>
            </div>
          </div>
        )}
        {/* Trash overlay */}
        {trashOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-gray-700/40 to-gray-900/40 rounded-2xl">
            <div className="border-4 border-gray-400 rounded-xl px-8 py-4 rotate-[15deg]">
              <span className="text-gray-400 font-black text-5xl tracking-widest">🗑️ TRASH</span>
            </div>
          </div>
        )}

        {/* YouTube embed or placeholder */}
        <div className="relative flex-1 bg-black min-h-0">
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=0&controls=1&rel=0`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={submission.songTitle}
            />
          ) : submission.fileUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
              <Music className="w-16 h-16 text-red-600/60" />
              <audio controls src={submission.fileUrl} className="w-full max-w-xs" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-20 h-20 text-white/10" />
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="p-4 bg-[#0d0d0d] border-t border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white font-bold text-lg leading-tight truncate">{submission.songTitle}</p>
              <p className="text-white/50 text-sm truncate">{submission.artistName}</p>
            </div>
            <div className="flex-shrink-0 text-right text-xs text-white/30">
              <div className="text-orange-400 font-bold">{submission.fireCount} 🔥</div>
              <div className="text-gray-400">{submission.trashCount} 🗑️</div>
            </div>
          </div>
          {/* Fire/trash bar */}
          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all"
              style={{ width: `${firePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>🔥 {firePercent}% Fire</span>
            <span>{100 - firePercent}% Trash 🗑️</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FireOrTrash() {
  const { user, isAuthenticated } = useAuth();
  const [queue, setQueue] = useState<Submission[]>([]);
  const [done, setDone] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [tab, setTab] = useState<"game" | "stats" | "leaderboard">("game");

  const { data: queueData, isLoading, refetch } = trpc.fireTrash.getQueue.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated, refetchOnWindowFocus: false }
  );
  const { data: myStats } = trpc.fireTrash.getMyStats.useQuery(undefined, { enabled: isAuthenticated });
  const { data: leaderboard } = trpc.fireTrash.getLeaderboard.useQuery(undefined);

  const voteMutation = trpc.fireTrash.vote.useMutation({
    onError: (err: { message: string }) => toast.error(err.message),
  });

  useEffect(() => {
    if (queueData && queueData.length > 0) {
      setQueue(queueData as Submission[]);
      setDone(false);
    } else if (queueData && queueData.length === 0 && !isLoading) {
      setDone(true);
    }
  }, [queueData, isLoading]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tab !== "game" || queue.length === 0) return;
      if (e.key === "ArrowRight") handleVote("fire");
      if (e.key === "ArrowLeft") handleVote("trash");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVote = useCallback((vote: "fire" | "trash") => {
    if (queue.length === 0) return;
    const top = queue[0];
    voteMutation.mutate({ submissionId: top.id, vote });
    setVoteCount(c => c + 1);
    setQueue(prev => prev.slice(1));
    if (queue.length === 1) {
      setDone(true);
    }
  }, [queue, voteMutation]);

  const handleRefresh = () => {
    setDone(false);
    setQueue([]);
    refetch();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
          <div className="text-6xl">🔥🗑️</div>
          <h1 className="font-['Anton'] text-4xl text-center">FIRE OR TRASH</h1>
          <p className="text-white/50 text-center max-w-sm">Log in to vote on tracks and see your stats</p>
          <a
            href={getLoginUrl()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-bold uppercase tracking-widest transition-all"
          >
            <LogIn className="w-4 h-4" />
            Log In to Play
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {/* Header */}
      <div className="container pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-['Anton'] text-3xl md:text-4xl tracking-wider">
              🔥 FIRE OR <span className="text-red-600">TRASH</span> 🗑️
            </h1>
            <p className="text-white/40 text-sm mt-1">Swipe right = Fire · Swipe left = Trash · ← → keys work too</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-500">{voteCount}</div>
            <div className="text-white/30 text-xs uppercase tracking-widest">Votes Today</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-white/10">
          {[
            { id: "game", label: "🎮 Play", icon: null },
            { id: "stats", label: "📊 My Stats", icon: null },
            { id: "leaderboard", label: "🏆 Leaderboard", icon: null },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-all border-b-2 -mb-px ${
                tab === t.id
                  ? "border-red-600 text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Game Tab */}
      {tab === "game" && (
        <div className="container pb-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full" />
            </div>
          ) : done || queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 gap-6">
              <div className="text-6xl">✅</div>
              <h2 className="font-['Anton'] text-3xl text-center">YOU'RE ALL CAUGHT UP</h2>
              <p className="text-white/40 text-center">You've voted on all available tracks. Check back after the next live session!</p>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 px-6 py-3 font-semibold uppercase tracking-widest transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Check for New Tracks
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {/* Card stack */}
              <div className="relative w-full max-w-sm mx-auto" style={{ height: "480px" }}>
                {queue.slice(0, 3).map((sub, i) => (
                  <SwipeCard
                    key={sub.id}
                    submission={sub}
                    onFire={() => handleVote("fire")}
                    onTrash={() => handleVote("trash")}
                    isTop={i === 0}
                    offset={i}
                  />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-8">
                <button
                  onClick={() => handleVote("trash")}
                  className="w-16 h-16 rounded-full border-2 border-gray-500 bg-gray-900/50 flex items-center justify-center hover:border-gray-300 hover:bg-gray-800/50 transition-all active:scale-95"
                  title="Trash (← key)"
                >
                  <Trash2 className="w-7 h-7 text-gray-400" />
                </button>
                <div className="text-white/20 text-sm">
                  {queue.length} left
                </div>
                <button
                  onClick={() => handleVote("fire")}
                  className="w-16 h-16 rounded-full border-2 border-orange-500 bg-orange-900/30 flex items-center justify-center hover:border-orange-400 hover:bg-orange-800/30 transition-all active:scale-95"
                  title="Fire (→ key)"
                >
                  <Flame className="w-7 h-7 text-orange-400" />
                </button>
              </div>

              <p className="text-white/20 text-xs text-center">
                Swipe right or press → for 🔥 FIRE · Swipe left or press ← for 🗑️ TRASH
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="container pb-8 max-w-lg">
          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              { label: "Total Votes", value: myStats?.totalVotes ?? 0, color: "text-white" },
              { label: "🔥 Fire Votes", value: myStats?.fireVotes ?? 0, color: "text-orange-400" },
              { label: "🗑️ Trash Votes", value: myStats?.trashVotes ?? 0, color: "text-gray-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 p-4 text-center">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-white/40 text-xs uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {myStats && myStats.totalVotes > 0 && (
            <div className="mt-4 bg-white/5 border border-white/10 p-4">
              <p className="text-white/50 text-sm mb-2">Your Taste Profile</p>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-600"
                  style={{ width: `${Math.round((myStats.fireVotes / myStats.totalVotes) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/30 mt-1">
                <span>🔥 {Math.round((myStats.fireVotes / myStats.totalVotes) * 100)}% Fire</span>
                <span>{Math.round((myStats.trashVotes / myStats.totalVotes) * 100)}% Trash 🗑️</span>
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-white/30 text-xs">Each vote earns you XP toward your fan level</p>
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === "leaderboard" && (
        <div className="container pb-8 max-w-2xl">
          <h2 className="text-white/50 text-sm uppercase tracking-widest mt-6 mb-4">Most Fire Tracks</h2>
          {!leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-16 text-white/30">No votes yet — be the first to vote!</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((track: { id: number; artistName: string; songTitle: string; fireCount: number; trashCount: number; userId: number | null }, i: number) => {
                const total = track.fireCount + track.trashCount;
                const fp = total > 0 ? Math.round((track.fireCount / total) * 100) : 50;
                return (
                  <div key={track.id} className="flex items-center gap-4 bg-white/[0.03] border border-white/10 p-4 hover:border-red-600/30 transition-all">
                    <div className={`text-2xl font-bold w-8 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-orange-400" : "text-white/30"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{track.songTitle}</p>
                      <p className="text-white/40 text-sm truncate">{track.artistName}</p>
                      <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-500 to-red-600" style={{ width: `${fp}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-orange-400 font-bold">{track.fireCount} 🔥</div>
                      <div className="text-gray-400 text-sm">{track.trashCount} 🗑️</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
