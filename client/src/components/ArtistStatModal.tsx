/* ============================================================
   ArtistStatModal — click any artist name to see their profile
   Shows: W/L battle record, song catalogue with inline player,
   Instagram link, and (for own profile) song upload form.
   ============================================================ */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface ArtistStatModalProps {
  artistName: string;
  userId?: number | null;
  children: React.ReactNode; // the clickable trigger element
}

interface Song {
  id: number;
  title: string;
  artistName: string;
  fileUrl?: string | null;
  externalUrl?: string | null;
  genre?: string | null;
  isPublic: boolean;
  uploadedAt: Date;
}

interface BattleRecord {
  id: number;
  roundNumber: number;
  winnerArtistName: string;
  winnerSongTitle: string;
  loserArtistName: string;
  loserSongTitle: string;
  battleDate: Date;
  notes?: string | null;
}

// ─── Inline Audio Player ──────────────────────────────────────
function AudioPlayer({ song }: { song: Song }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const isUploadedFile = !!song.fileUrl;
  const isExternal = !!song.externalUrl;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct = (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
    setProgress(pct);
  };

  const handleEnded = () => setPlaying(false);

  if (!isUploadedFile && !isExternal) {
    return <span className="text-white/30 text-xs italic">No audio</span>;
  }

  // External links (YouTube/SoundCloud) open in new tab
  if (!isUploadedFile && isExternal) {
    return (
      <a
        href={song.externalUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Play on {song.externalUrl!.includes("youtube") ? "YouTube" : "SoundCloud"}
      </a>
    );
  }

  // Uploaded audio file — inline HTML5 player
  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={song.fileUrl!}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
      <button
        onClick={togglePlay}
        className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        {playing ? (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-red-600 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Song Upload Form ─────────────────────────────────────────
function SongUploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [tab, setTab] = useState<"link" | "file">("link");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState("");

  const addExternal = trpc.songs.addExternal.useMutation({ onSuccess });
  const uploadAudio = trpc.songs.uploadAudio.useMutation({ onSuccess });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !artistName.trim()) { setError("Title and artist name are required."); return; }

    if (tab === "link") {
      if (!externalUrl.trim()) { setError("Please enter a URL."); return; }
      await addExternal.mutateAsync({ title, artistName, externalUrl, genre: genre || undefined, isPublic });
    } else {
      if (!file) { setError("Please select an audio file."); return; }
      if (file.size > 15 * 1024 * 1024) { setError("File must be under 15MB."); return; }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadAudio.mutateAsync({
        title, artistName, genre: genre || undefined, isPublic,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type || "audio/mpeg",
      });
    }
  };

  const isPending = addExternal.isPending || uploadAudio.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4 pt-4 border-t border-white/10">
      <div className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-2">Add a Song</div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-white/5 p-1 rounded">
        {(["link", "file"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs uppercase tracking-wider transition-colors ${
              tab === t ? "bg-red-600 text-white" : "text-white/40 hover:text-white"
            }`}
          >
            {t === "link" ? "YouTube / SoundCloud" : "Upload File"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text" placeholder="Song Title *" value={title}
          onChange={e => setTitle(e.target.value)} required maxLength={128}
          className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/30"
        />
        <input
          type="text" placeholder="Artist Name *" value={artistName}
          onChange={e => setArtistName(e.target.value)} required maxLength={128}
          className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/30"
        />
      </div>

      <input
        type="text" placeholder="Genre (optional)" value={genre}
        onChange={e => setGenre(e.target.value)} maxLength={64}
        className="w-full bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/30"
      />

      {tab === "link" ? (
        <input
          type="url" placeholder="YouTube or SoundCloud URL" value={externalUrl}
          onChange={e => setExternalUrl(e.target.value)}
          className="w-full bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/30"
        />
      ) : (
        <div>
          <label className="block text-xs text-white/40 mb-1">Audio file (.mp3, .wav, .ogg) — max 15MB</label>
          <input
            type="file" accept="audio/*"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-white/60 file:bg-red-600 file:text-white file:border-0 file:px-3 file:py-1.5 file:text-xs file:cursor-pointer file:mr-3"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
        <input
          type="checkbox" checked={isPublic}
          onChange={e => setIsPublic(e.target.checked)}
          className="accent-red-600"
        />
        Make this song public on my profile
      </label>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit" disabled={isPending}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2 text-xs font-semibold uppercase tracking-widest transition-colors"
      >
        {isPending ? "Saving..." : "Add Song"}
      </button>
    </form>
  );
}

// ─── Main Modal ───────────────────────────────────────────────
export function ArtistStatModal({ artistName, userId, children }: ArtistStatModalProps) {
  const [open, setOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser && userId && currentUser.id === userId;

  // Fetch profile data when modal opens
  const { data: profile, refetch: refetchProfile } = trpc.profile.getById.useQuery(
    { userId: userId! },
    { enabled: open && !!userId }
  );
  const { data: nameStats } = trpc.profile.getByName.useQuery(
    { artistName },
    { enabled: open && !userId }
  );
  const { data: songs, refetch: refetchSongs } = trpc.songs.byUser.useQuery(
    { userId: userId! },
    { enabled: open && !!userId }
  );
  const deleteSong = trpc.songs.delete.useMutation({
    onSuccess: () => { refetchSongs(); refetchProfile(); }
  });

  const stats = profile?.stats ?? nameStats;
  const songList = songs ?? [];
  const igHandle = profile?.user?.instagramHandle;
  const displayName = profile?.artistName ?? artistName;

  const handleClose = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).id === "modal-backdrop") setOpen(false);
  }, []);

  return (
    <>
      {/* Trigger */}
      <span
        onClick={() => setOpen(true)}
        className="cursor-pointer hover:text-red-400 transition-colors underline decoration-dotted underline-offset-2"
        title={`View ${artistName}'s profile`}
      >
        {children}
      </span>

      {/* Modal */}
      {open && (
        <div
          id="modal-backdrop"
          onClick={handleClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div
            className="bg-[#111] border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="font-['Anton'] text-2xl uppercase">{displayName}</h2>
                {igHandle && (
                  <a
                    href={`https://instagram.com/${igHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-red-400 hover:text-red-300 transition-colors mt-0.5 inline-block"
                  >
                    @{igHandle} on Instagram
                  </a>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition-colors ml-4 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Battle Record */}
              <div>
                <div className="text-xs text-white/40 uppercase tracking-widest mb-3 font-semibold">Battle Record</div>
                {stats ? (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-green-900/20 border border-green-600/20 p-3 text-center">
                      <div className="font-['Anton'] text-3xl text-green-400">{stats.wins}</div>
                      <div className="text-xs text-white/40 uppercase tracking-wider">Wins</div>
                    </div>
                    <div className="bg-red-900/20 border border-red-600/20 p-3 text-center">
                      <div className="font-['Anton'] text-3xl text-red-400">{stats.losses}</div>
                      <div className="text-xs text-white/40 uppercase tracking-wider">Losses</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-3 text-center">
                      <div className="font-['Anton'] text-3xl text-white">{stats.total}</div>
                      <div className="text-xs text-white/40 uppercase tracking-wider">Total</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/30 text-xs">No battles recorded yet.</p>
                )}

                {/* Battle history */}
                {stats && stats.records && stats.records.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(stats.records as BattleRecord[]).map(r => {
                      const won = r.winnerArtistName === displayName;
                      return (
                        <div key={r.id} className="flex items-center gap-3 py-2 border-b border-white/5 text-xs">
                          <span className={`font-bold flex-shrink-0 w-8 text-center ${won ? "text-green-400" : "text-red-400"}`}>
                            {won ? "W" : "L"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white/70 truncate">
                              vs {won ? r.loserArtistName : r.winnerArtistName}
                            </div>
                            <div className="text-white/40 truncate">
                              {won ? r.winnerSongTitle : r.loserSongTitle}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-white/30 text-xs">Rd {r.roundNumber}</div>
                            <div className="text-white/20 text-xs">{new Date(r.battleDate).toLocaleDateString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Song Catalogue */}
              <div>
                <div className="text-xs text-white/40 uppercase tracking-widest mb-3 font-semibold">
                  Song Catalogue {songList.length > 0 && `(${songList.length})`}
                </div>
                {songList.length === 0 ? (
                  <p className="text-white/30 text-xs">No songs added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {songList.map(song => (
                      <div key={song.id} className="bg-white/[0.03] border border-white/5 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="text-sm text-white font-semibold truncate">{song.title}</div>
                            {song.genre && (
                              <div className="text-xs text-white/30">{song.genre}</div>
                            )}
                          </div>
                          {isOwnProfile && (
                            <button
                              onClick={() => deleteSong.mutate({ id: song.id })}
                              className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                              title="Remove song"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <AudioPlayer song={song} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload form for own profile */}
                {isOwnProfile && (
                  <SongUploadForm onSuccess={() => { refetchSongs(); refetchProfile(); }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
