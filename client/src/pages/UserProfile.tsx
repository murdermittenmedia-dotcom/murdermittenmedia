/* ============================================================
   USER PROFILE PAGE
   - Own profile: edit name/city/IG, upload avatar, view stats + submissions
   - Visiting others: view their public profile + music catalogue
   - Music Catalogue: upload songs (owner only), play any song
   ============================================================ */

import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteNav } from "@/components/SiteNav";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { toast } from "sonner";
import {
  Flame, Trash2, Music, Play, Pause, Camera, Edit2, Check, X,
  Instagram, Trophy, Mic, MapPin, Upload, Plus, Globe, Eye, EyeOff,
  Loader2,
} from "lucide-react";

type Submission = {
  id: number;
  artistName: string;
  songTitle: string;
  submissionType: "youtube" | "file";
  youtubeUrl: string | null;
  fileUrl: string | null;
  fileKey: string | null;
  status: "pending" | "playing" | "reviewed" | "removed";
  fireCount: number;
  trashCount: number;
  createdAt: Date;
};

type UserSong = {
  id: number;
  userId: number;
  title: string;
  artistName: string;
  fileKey: string | null;
  fileUrl: string | null;
  externalUrl: string | null;
  genre: string | null;
  isPublic: boolean;
  uploadedAt: Date;
};

// ── Upload Song Form (owner only) ─────────────────────────────
function UploadSongForm({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [uploading, setUploading] = useState(false);

  const uploadSong = trpc.songs.uploadAudio.useMutation({
    onSuccess: () => {
      toast.success("Song added to your catalogue!");
      setSongTitle(""); setGenre(""); setAudioFile(null); setExternalUrl("");
      setOpen(false);
      onUploaded();
    },
    onError: (err) => { toast.error(err.message); setUploading(false); },
  });

  const addExternal = trpc.songs.addExternal.useMutation({
    onSuccess: () => {
      toast.success("Song added to your catalogue!");
      setSongTitle(""); setGenre(""); setExternalUrl("");
      setOpen(false);
      onUploaded();
    },
    onError: (err) => { toast.error(err.message); setUploading(false); },
  });

  const { data: me } = trpc.profile.me.useQuery();
  const artistName = me?.user.artistName || me?.artistName || "Artist";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/aac", "audio/x-m4a"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|aac)$/i)) {
      toast.error("Only MP3, WAV, M4A, or AAC files allowed");
      return;
    }
    if (file.size > 15 * 1024 * 1024) { toast.error("File must be under 15MB"); return; }
    setAudioFile(file);
  };

  const handleSubmit = async () => {
    if (!songTitle.trim()) { toast.error("Song title required"); return; }
    setUploading(true);
    if (uploadMode === "link") {
      if (!externalUrl.trim()) { toast.error("URL required"); setUploading(false); return; }
      addExternal.mutate({ title: songTitle.trim(), artistName, externalUrl: externalUrl.trim(), genre: genre || undefined, isPublic });
    } else {
      if (!audioFile) { toast.error("Select an audio file"); setUploading(false); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        uploadSong.mutate({
          title: songTitle.trim(),
          artistName,
          genre: genre || undefined,
          isPublic,
          fileName: audioFile.name,
          fileBase64: base64,
          mimeType: audioFile.type || "audio/mpeg",
        });
      };
      reader.readAsDataURL(audioFile);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-dashed border-red-600/40 text-red-500 hover:border-red-600 hover:bg-red-600/5 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold transition-all"
      >
        <Plus className="w-4 h-4" /> Add Song
      </button>
    );
  }

  return (
    <div className="border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Add to Catalogue</span>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(["file", "link"] as const).map(m => (
          <button
            key={m}
            onClick={() => setUploadMode(m)}
            className={`text-xs px-3 py-1.5 border uppercase tracking-widest font-semibold transition-all ${
              uploadMode === m ? "border-red-600 text-red-500 bg-red-600/10" : "border-white/10 text-white/40 hover:border-white/30"
            }`}
          >
            {m === "file" ? "Upload MP3" : "Link (YouTube/SC)"}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Song Title *</label>
        <input
          value={songTitle}
          onChange={e => setSongTitle(e.target.value)}
          placeholder="Track name..."
          className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-red-600/50 placeholder-white/20"
          maxLength={128}
        />
      </div>

      {uploadMode === "file" ? (
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Audio File *</label>
          {audioFile ? (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2">
              <Music className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs text-white/80 truncate flex-1">{audioFile.name}</span>
              <button onClick={() => setAudioFile(null)} className="text-white/30 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 bg-white/5 border border-dashed border-white/20 px-3 py-2 cursor-pointer hover:border-red-600/50 transition-colors">
              <Upload className="w-4 h-4 text-white/30" />
              <span className="text-xs text-white/30">MP3, WAV, M4A — max 15MB</span>
              <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" className="hidden" onChange={handleFileSelect} />
            </label>
          )}
        </div>
      ) : (
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">YouTube / SoundCloud URL *</label>
          <input
            value={externalUrl}
            onChange={e => setExternalUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-red-600/50 placeholder-white/20"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Genre</label>
          <input
            value={genre}
            onChange={e => setGenre(e.target.value)}
            placeholder="Rap, Drill..."
            className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:border-red-600/50 placeholder-white/20"
            maxLength={64}
          />
        </div>
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Visibility</label>
          <button
            onClick={() => setIsPublic(v => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs border transition-all ${
              isPublic ? "border-green-500/40 text-green-400 bg-green-500/5" : "border-white/10 text-white/40"
            }`}
          >
            {isPublic ? <><Eye className="w-3.5 h-3.5" /> Public</> : <><EyeOff className="w-3.5 h-3.5" /> Private</>}
          </button>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={uploading || uploadSong.isPending || addExternal.isPending}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
      >
        {(uploading || uploadSong.isPending || addExternal.isPending) ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
        ) : (
          <><Plus className="w-4 h-4" /> Add to Catalogue</>
        )}
      </button>
    </div>
  );
}

// ── Music Catalogue Section ───────────────────────────────────
function MusicCatalogue({
  songs,
  isOwner,
  artistName,
  onRefetch,
}: {
  songs: UserSong[];
  isOwner: boolean;
  artistName: string;
  onRefetch: () => void;
}) {
  const deleteSong = trpc.songs.delete.useMutation({
    onSuccess: () => { toast.success("Song removed"); onRefetch(); },
    onError: (err) => toast.error(err.message),
  });
  const setVisibility = trpc.songs.setVisibility.useMutation({
    onSuccess: () => { toast.success("Visibility updated"); onRefetch(); },
  });

  const publicSongs = isOwner ? songs : songs.filter(s => s.isPublic);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-red-600" />
          <h2 className="font-['Anton'] text-2xl uppercase">Music Catalogue</h2>
          {publicSongs.length > 0 && (
            <span className="text-white/30 text-sm">{publicSongs.length} track{publicSongs.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {isOwner && <UploadSongForm onUploaded={onRefetch} />}
      </div>

      {publicSongs.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.03] p-10 text-center">
          <Music className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            {isOwner ? "No songs in your catalogue yet. Add your first track above." : `${artistName} hasn't added any songs yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {publicSongs.map((song) => (
            <div
              key={song.id}
              className="border border-white/10 bg-white/[0.03] hover:border-red-600/30 hover:bg-white/[0.05] transition-all duration-200 p-3 flex items-center gap-3"
            >
              {/* Play button */}
              {(song.fileKey || song.fileUrl) ? (
                <AudioPlayButton
                  fileKey={song.fileKey ?? undefined}
                  url={song.fileUrl ?? undefined}
                  title={song.title}
                  artist={song.artistName}
                  sourcePage="Profile"
                  size="md"
                />
              ) : song.externalUrl ? (
                <a
                  href={song.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-600 text-white transition-all"
                  title="Open on YouTube/SoundCloud"
                >
                  <Globe className="w-4 h-4" />
                </a>
              ) : (
                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/20">
                  <Music className="w-4 h-4" />
                </div>
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{song.title}</div>
                <div className="text-white/40 text-xs flex items-center gap-2 mt-0.5">
                  {song.genre && <span className="border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">{song.genre}</span>}
                  {song.externalUrl && <span className="text-blue-400/60 text-[10px] uppercase">External Link</span>}
                  {!song.isPublic && isOwner && (
                    <span className="text-white/20 text-[10px] uppercase flex items-center gap-0.5"><EyeOff className="w-2.5 h-2.5" /> Private</span>
                  )}
                </div>
              </div>

              {/* Owner controls */}
              {isOwner && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setVisibility.mutate({ id: song.id, isPublic: !song.isPublic })}
                    className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
                    title={song.isPublic ? "Make private" : "Make public"}
                  >
                    {song.isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { if (confirm("Remove this song?")) deleteSong.mutate({ id: song.id }); }}
                    className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
                    title="Remove song"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function UserProfile() {
  const { user, loading: authLoading } = useAuth();

  // Support /profile (own) and /profile/:id (visiting others)
  const [matchOwn] = useRoute("/profile");
  const [matchOther, params] = useRoute("/profile/:id");
  const visitingId = matchOther && params?.id ? parseInt(params.id, 10) : null;
  const isOwnProfile = !visitingId || (user?.id === visitingId);

  // Profile edit state (own profile only)
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [igInput, setIgInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Data queries
  const { data: ownProfile, refetch: refetchOwnProfile } = trpc.profile.me.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: visitingProfile, refetch: refetchVisitingProfile } = trpc.profile.getById.useQuery(
    { userId: visitingId! },
    { enabled: !!visitingId && !isOwnProfile }
  );

  const profileData = isOwnProfile ? ownProfile : visitingProfile;
  const refetchProfile = isOwnProfile ? refetchOwnProfile : refetchVisitingProfile;

  const { data: stats } = trpc.profile.getStats.useQuery(undefined, { enabled: !!user && isOwnProfile });
  const { data: submissions } = trpc.profile.getSubmissions.useQuery(undefined, { enabled: !!user && isOwnProfile });

  // Songs catalogue
  const { data: ownSongs, refetch: refetchOwnSongs } = trpc.songs.mine.useQuery(undefined, {
    enabled: !!user && isOwnProfile,
  });
  const { data: publicSongs, refetch: refetchPublicSongs } = trpc.songs.byUser.useQuery(
    { userId: visitingId ?? (user?.id ?? 0) },
    { enabled: !isOwnProfile && !!visitingId }
  );

  const songs: UserSong[] = (isOwnProfile ? ownSongs : publicSongs) as UserSong[] ?? [];
  const refetchSongs = isOwnProfile ? refetchOwnSongs : refetchPublicSongs;

  // Mutations
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated!");
      setSavingProfile(false);
      setEditingName(false);
      refetchOwnProfile();
    },
    onError: (err) => {
      toast.error("Failed to update: " + err.message);
      setSavingProfile(false);
    },
  });

  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: (data) => {
      toast.success("Profile picture updated!");
      setUploadingAvatar(false);
      setAvatarPreview(data.avatarUrl);
      refetchOwnProfile();
    },
    onError: (err) => {
      toast.error("Upload failed: " + err.message);
      setUploadingAvatar(false);
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Only JPG, PNG, WebP, or GIF allowed");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setAvatarPreview(ev.target?.result as string);
      uploadAvatarMutation.mutate({
        base64,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    if (!nameInput.trim()) { toast.error("Artist name can't be empty"); return; }
    setSavingProfile(true);
    updateProfileMutation.mutate({
      artistName: nameInput.trim(),
      instagramHandle: igInput.trim() || undefined,
      city: cityInput.trim() || undefined,
    });
  };

  const displayProfile = profileData;
  const displayName = displayProfile?.user.artistName || displayProfile?.artistName || (isOwnProfile ? user?.name : "Artist") || "Artist";
  const userCity = (displayProfile?.user as { city?: string | null } | undefined)?.city;
  const avatarUrl = (isOwnProfile ? avatarPreview : null) || displayProfile?.user.avatarUrl || null;
  const initials = displayName.slice(0, 2).toUpperCase();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Visiting a profile that doesn't exist
  if (!isOwnProfile && !visitingProfile && !authLoading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <div className="container pt-32 text-center">
          <p className="text-white/40 text-lg">Profile not found.</p>
          <a href="/" className="text-red-500 hover:underline mt-4 inline-block">← Go Home</a>
        </div>
      </div>
    );
  }

  if (!user && isOwnProfile) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">You need to be logged in to view your profile.</p>
          <a href="/login" className="text-red-500 underline">Log in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      <div className="container pt-24 pb-16 max-w-3xl mx-auto px-4">

        {/* ── Profile Header ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className={`w-28 h-28 rounded-full border-2 border-red-600/50 overflow-hidden bg-red-600/20 flex items-center justify-center ${isOwnProfile ? "cursor-pointer group" : ""}`}
              onClick={() => isOwnProfile && avatarInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-['Anton'] text-3xl text-red-500">{initials}</span>
              )}
              {isOwnProfile && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              )}
            </div>
            {isOwnProfile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  className="absolute bottom-0 right-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Change profile picture"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
              </>
            )}
          </div>

          {/* Name & Info */}
          <div className="flex-1 text-center sm:text-left">
            {isOwnProfile && editingName ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Artist Name</label>
                  <input
                    className="bg-white/10 border border-white/20 text-white px-3 py-2 w-full max-w-xs focus:border-red-600 outline-none text-lg font-['Anton'] uppercase"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="Your artist name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">City / Hometown</label>
                  <div className="flex items-center border border-white/20 focus-within:border-red-600 bg-white/10 max-w-xs">
                    <MapPin className="w-4 h-4 text-white/30 ml-3 flex-shrink-0" />
                    <input
                      className="flex-1 bg-transparent text-white px-2 py-2 focus:outline-none placeholder-white/30"
                      value={cityInput}
                      onChange={e => setCityInput(e.target.value)}
                      placeholder="Detroit, MI"
                      maxLength={128}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Instagram Handle</label>
                  <input
                    className="bg-white/10 border border-white/20 text-white px-3 py-2 w-full max-w-xs focus:border-red-600 outline-none"
                    value={igInput}
                    onChange={e => setIgInput(e.target.value)}
                    placeholder="@yourhandle"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                  <button
                    className="flex items-center gap-1 border border-white/20 text-white/60 hover:text-white px-4 py-2 text-sm transition-colors"
                    onClick={() => setEditingName(false)}
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 justify-center sm:justify-start mb-1">
                  <h1 className="font-['Anton'] text-3xl uppercase">{displayName}</h1>
                  {isOwnProfile && (
                    <button
                      className="text-white/30 hover:text-red-500 transition-colors"
                      onClick={() => {
                        setNameInput(ownProfile?.user.artistName || ownProfile?.artistName || user?.name || "");
                        setIgInput(ownProfile?.user.instagramHandle || "");
                        setCityInput(userCity || "");
                        setEditingName(true);
                      }}
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {userCity ? (
                  <div className="flex items-center gap-1 text-white/40 text-sm mb-1 justify-center sm:justify-start">
                    <MapPin className="w-3 h-3" />
                    <span>{userCity}</span>
                  </div>
                ) : isOwnProfile ? (
                  <button
                    className="flex items-center gap-1 text-white/20 hover:text-white/50 text-xs transition-colors mt-0.5 mb-1 mx-auto sm:mx-0"
                    onClick={() => {
                      setNameInput(ownProfile?.user.artistName || ownProfile?.artistName || user?.name || "");
                      setIgInput(ownProfile?.user.instagramHandle || "");
                      setCityInput("");
                      setEditingName(true);
                    }}
                  >
                    <MapPin className="w-3 h-3" />
                    + Add your city
                  </button>
                ) : null}

                {displayProfile?.user.instagramHandle && (
                  <a
                    href={`https://instagram.com/${displayProfile.user.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-white/40 hover:text-red-500 text-sm transition-colors justify-center sm:justify-start"
                  >
                    <Instagram className="w-3 h-3" />
                    @{displayProfile.user.instagramHandle}
                  </a>
                )}
                {!displayProfile?.user.instagramHandle && isOwnProfile && (
                  <button
                    className="text-white/30 hover:text-white/60 text-xs transition-colors mt-1"
                    onClick={() => {
                      setNameInput(ownProfile?.user.artistName || ownProfile?.artistName || user?.name || "");
                      setIgInput("");
                      setCityInput(userCity || "");
                      setEditingName(true);
                    }}
                  >
                    + Add Instagram handle
                  </button>
                )}
                <div className="mt-2 text-xs text-white/30 uppercase tracking-widest">
                  {isOwnProfile
                    ? (user?.role === "admin" ? "Admin" : user?.role === "judge" ? "Judge" : "Artist")
                    : (displayProfile?.user.role === "admin" ? "Admin" : displayProfile?.user.role === "judge" ? "Judge" : "Artist")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Lifetime Stats (own profile only) ──────────── */}
        {isOwnProfile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {[
              { icon: <Music className="w-5 h-5 text-white/50" />, value: stats?.totalSubmissions ?? 0, label: "Submissions" },
              { icon: <Flame className="w-5 h-5 text-orange-500" />, value: stats?.totalFire ?? 0, label: "Fire Votes" },
              { icon: <Trash2 className="w-5 h-5 text-white/40" />, value: stats?.totalTrash ?? 0, label: "Trash Votes" },
              { icon: <Trophy className="w-5 h-5 text-yellow-500" />, value: stats?.reviewed ?? 0, label: "Reviewed" },
            ].map((s) => (
              <div key={s.label} className="border border-white/10 bg-white/[0.03] p-4 flex flex-col items-center gap-2">
                {s.icon}
                <div className="font-['Anton'] text-3xl">{s.value}</div>
                <div className="text-white/40 text-xs uppercase tracking-widest text-center">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Music Catalogue ─────────────────────────────── */}
        <div className="mb-12">
          <MusicCatalogue
            songs={songs}
            isOwner={isOwnProfile}
            artistName={displayName}
            onRefetch={() => refetchSongs()}
          />
        </div>

        {/* ── Submission History (own profile only) ───────── */}
        {isOwnProfile && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-red-600" />
              <h2 className="font-['Anton'] text-2xl uppercase">Submission History</h2>
            </div>

            {!submissions || submissions.length === 0 ? (
              <div className="border border-white/10 bg-white/[0.03] p-10 text-center">
                <Mic className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No submissions yet.</p>
                <a href="/review" className="text-red-500 text-sm hover:underline mt-2 inline-block">
                  Submit your first track →
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {(submissions as Submission[]).map((sub) => {
                  const hasAudio = sub.submissionType === "youtube" ? !!sub.youtubeUrl : (!!sub.fileKey || !!sub.fileUrl);

                  return (
                    <div
                      key={sub.id}
                      className="border border-white/10 bg-white/[0.03] hover:border-white/20 p-4 flex items-center gap-4 transition-all duration-200"
                    >
                      {/* Play button */}
                      {sub.submissionType === "youtube" && sub.youtubeUrl ? (
                        <a
                          href={sub.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center border border-red-600/50 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                          title="Open on YouTube"
                        >
                          <Play className="w-4 h-4" />
                        </a>
                      ) : hasAudio ? (
                        <AudioPlayButton
                          fileKey={sub.fileKey ?? undefined}
                          url={sub.fileUrl ?? undefined}
                          urlSource="queue"
                          title={sub.songTitle}
                          artist={sub.artistName}
                          sourcePage="Profile"
                          size="md"
                        />
                      ) : (
                        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center border border-white/10 text-white/20">
                          <Play className="w-4 h-4" />
                        </div>
                      )}

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">{sub.songTitle}</div>
                        <div className="text-white/40 text-xs mt-0.5">
                          {new Date(sub.createdAt).toLocaleDateString()} ·{" "}
                          <span className={
                            sub.status === "reviewed" ? "text-green-500" :
                            sub.status === "playing" ? "text-red-500" :
                            sub.status === "removed" ? "text-white/20" :
                            "text-yellow-500"
                          }>
                            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      {/* Fire/Trash counts */}
                      <div className="flex items-center gap-3 text-sm flex-shrink-0">
                        <span className="flex items-center gap-1 text-orange-500">
                          <Flame className="w-3.5 h-3.5" />
                          {sub.fireCount}
                        </span>
                        <span className="flex items-center gap-1 text-white/30">
                          <Trash2 className="w-3.5 h-3.5" />
                          {sub.trashCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
