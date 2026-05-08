/* ============================================================
   ArtistStatModal — click any artist name to see their profile
   Shows: W/L battle record, song catalogue with inline player,
   Instagram link, city, and (for own profile) song upload form.
   ============================================================ */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { MapPin, ExternalLink, X, ChevronDown, ChevronUp } from "lucide-react";
import { AudioPlayButton } from "@/components/AudioPlayButton";

interface ArtistStatModalProps {
  artistName: string;
  userId?: number | null;
  children: React.ReactNode; // the clickable trigger element
}

interface Song {
  id: number;
  title: string;
  artistName: string;
  fileKey?: string | null;
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

// ─── Song Row ─────────────────────────────────────────────────
// Uses AudioPlayButton for uploaded files (same pattern as Forum).
// For YouTube/SoundCloud-only links: shows an inline YouTube embed
// or an external link button.
function SongRow({
  song,
  displayName,
  isOwn,
  onDelete,
}: {
  song: Song;
  displayName: string;
  isOwn: boolean;
  onDelete: () => void;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const isExternalOnly = !song.fileKey && !song.fileUrl && !!song.externalUrl;
  const isYouTube = song.externalUrl?.includes("youtube") || song.externalUrl?.includes("youtu.be");
  const ytId = song.externalUrl?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)(\w[\w-]{10})/)?.[1];

  return (
    <div className="bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-200">
      <div className="flex items-center gap-3 p-3">
        {/* Play button — AudioPlayButton for files, embed toggle for YouTube, link for others */}
        {!isExternalOnly ? (
          <AudioPlayButton
            fileKey={song.fileKey}
            url={song.fileUrl}
            urlSource="songs"
            title={song.title}
            artist={displayName}
            sourcePage="Artist Profile"
            sourceUrl="/profile"
            size="sm"
          />
        ) : isYouTube && ytId ? (
          <button
            onClick={() => setShowEmbed(v => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-red-600 hover:bg-red-700 text-white transition-colors"
            title={showEmbed ? "Hide video" : "Watch on page"}
          >
            {showEmbed ? <ChevronUp className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
          </button>
        ) : (
          <a
            href={song.externalUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/10 hover:bg-red-600 text-white transition-colors"
            title="Open on streaming platform"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-semibold truncate">{song.title}</div>
          {song.genre && <div className="text-xs text-white/30">{song.genre}</div>}
        </div>

        {/* External link badge */}
        {song.externalUrl && (
          <a
            href={song.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0"
            title="Open on streaming platform"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Delete button — own profile only */}
        {isOwn && (
          <button
            onClick={onDelete}
            className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
            title="Remove song"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Inline YouTube embed */}
      {showEmbed && ytId && (
        <div className="px-3 pb-3">
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
              className="absolute inset-0 w-full h-full border border-white/10"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={song.title}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Song Upload Form ─────────────────────────────────────────
function SongUploadForm({ onSuccess, defaultArtistName }: { onSuccess: () => void; defaultArtistName: string }) {
  const [tab, setTab] = useState<"link" | "file">("link");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState("");

  const addExternal = trpc.songs.addExternal.useMutation({ onSuccess: () => { setTitle(""); setExternalUrl(""); setGenre(""); onSuccess(); } });
  const uploadAudio = trpc.songs.uploadAudio.useMutation({ onSuccess: () => { setTitle(""); setFile(null); setGenre(""); onSuccess(); } });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Song title is required."); return; }

    if (tab === "link") {
      if (!externalUrl.trim()) { setError("Please enter a URL."); return; }
      await addExternal.mutateAsync({ title, artistName: defaultArtistName, externalUrl, genre: genre || undefined, isPublic });
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
        title, artistName: defaultArtistName, genre: genre || undefined, isPublic,
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

      <input
        type="text" placeholder="Song Title *" value={title}
        onChange={e => setTitle(e.target.value)} required maxLength={128}
        className="w-full bg-white/5 border border-white/10 text-white text-xs px-3 py-2 focus:outline-none focus:border-red-600/50 placeholder-white/30"
      />

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
          <label className="block text-xs text-white/40 mb-1">Audio file (.mp3, .wav, .m4a) — max 15MB</label>
          <input
            type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-white/60 file:bg-red-600 file:text-white file:border-0 file:px-3 file:py-1.5 file:text-xs file:cursor-pointer file:mr-3"
          />
          {file && (
            <p className="text-white/40 text-xs mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
          )}
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
  const isOwnProfile = !!(currentUser && userId && currentUser.id === userId);

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
  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => refetchProfile(),
  });

  const stats = profile?.stats ?? nameStats;
  const songList = (songs ?? []) as Song[];
  const igHandle = profile?.user?.instagramHandle;
  const avatarUrl = profile?.user?.avatarUrl;
  const displayName = profile?.artistName ?? artistName;
  const city = (profile?.user as { city?: string | null } | undefined)?.city;

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
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-red-600/20 border-2 border-red-600/30 flex items-center justify-center">
                      <span className="font-['Anton'] text-2xl text-red-400">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Upload button — own profile only */}
                  {isOwnProfile && (
                    <label
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center cursor-pointer transition-colors"
                      title="Change profile picture"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 4_000_000) { alert("Image must be under 4MB"); return; }
                          const reader = new FileReader();
                          reader.onload = async (ev) => {
                            const base64 = (ev.target?.result as string).split(",")[1];
                            try {
                              await uploadAvatarMutation.mutateAsync({
                                base64,
                                mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                              });
                            } catch (err) { console.error(err); }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <h2 className="font-['Anton'] text-2xl uppercase">{displayName}</h2>
                  {/* City */}
                  {city && (
                    <div className="flex items-center gap-1 text-white/40 text-xs mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{city}</span>
                    </div>
                  )}
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
                  {uploadAvatarMutation.isPending && (
                    <p className="text-xs text-white/40 mt-1">Uploading photo...</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white transition-colors ml-4 flex-shrink-0"
              >
                <X className="w-5 h-5" />
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
                  <div className="space-y-2">
                    {songList.map(song => (
                      <SongRow
                        key={song.id}
                        song={song}
                        displayName={displayName}
                        isOwn={isOwnProfile}
                        onDelete={() => deleteSong.mutate({ id: song.id })}
                      />
                    ))}
                  </div>
                )}

                {/* Upload form for own profile */}
                {isOwnProfile && (
                  <SongUploadForm
                    defaultArtistName={displayName}
                    onSuccess={() => { refetchSongs(); refetchProfile(); }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
