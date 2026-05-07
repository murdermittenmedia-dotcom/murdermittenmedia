/* ============================================================
   USER PROFILE PAGE
   - Edit display name, Instagram handle & city
   - Upload / change profile picture
   - Lifetime stats (submissions, fire, trash, reviewed)
   - All previous submissions (playable)
   ============================================================ */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { Flame, Trash2, Music, Play, Pause, Camera, Edit2, Check, X, Instagram, Trophy, Mic, MapPin } from "lucide-react";

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

export default function UserProfile() {
  const { user, loading: authLoading } = useAuth();
  const { track: currentTrack, isPlaying, play, pause } = useAudioPlayer();

  // Profile edit state
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
  const { data: profile, refetch: refetchProfile } = trpc.profile.me.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: stats } = trpc.profile.getStats.useQuery(undefined, { enabled: !!user });
  const { data: submissions } = trpc.profile.getSubmissions.useQuery(undefined, { enabled: !!user });

  // Mutations
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated!");
      setSavingProfile(false);
      setEditingName(false);
      refetchProfile();
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
      refetchProfile();
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

  const utils = trpc.useUtils();
  const handlePlaySubmission = async (sub: Submission) => {
    if (sub.submissionType === "youtube" && sub.youtubeUrl) {
      window.open(sub.youtubeUrl, "_blank");
      return;
    }
    if (!sub.fileKey && !sub.fileUrl) { toast.error("No audio available"); return; }
    let playUrl = sub.fileUrl;
    if (sub.fileKey) {
      try {
        const { url } = await utils.queue.getAudioUrl.fetch({ fileKey: sub.fileKey });
        playUrl = url;
      } catch { /* fallback to stored fileUrl */ }
    }
    if (!playUrl) { toast.error("Could not load audio"); return; }
    if (currentTrack?.url === playUrl && isPlaying) {
      pause();
    } else {
      play({ url: playUrl, title: sub.songTitle, artist: sub.artistName });
    }
  };

  const displayName = profile?.user.artistName || profile?.artistName || user?.name || "Artist";
  const userCity = (profile?.user as { city?: string | null } | undefined)?.city;
  const avatarUrl = avatarPreview || profile?.user.avatarUrl || null;
  const initials = displayName.slice(0, 2).toUpperCase();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
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
              className="w-28 h-28 rounded-full border-2 border-red-600/50 overflow-hidden bg-red-600/20 flex items-center justify-center cursor-pointer group"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-['Anton'] text-3xl text-red-500">{initials}</span>
              )}
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </div>
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
          </div>

          {/* Name & Info */}
          <div className="flex-1 text-center sm:text-left">
            {editingName ? (
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
                  <button
                    className="text-white/30 hover:text-red-500 transition-colors"
                    onClick={() => {
                      setNameInput(profile?.user.artistName || profile?.artistName || user?.name || "");
                      setIgInput(profile?.user.instagramHandle || "");
                      setCityInput(userCity || "");
                      setEditingName(true);
                    }}
                    title="Edit profile"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* City display */}
                {userCity ? (
                  <div className="flex items-center gap-1 text-white/40 text-sm mb-1 justify-center sm:justify-start">
                    <MapPin className="w-3 h-3" />
                    <span>{userCity}</span>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 text-white/20 hover:text-white/50 text-xs transition-colors mt-0.5 mb-1 mx-auto sm:mx-0"
                    onClick={() => {
                      setNameInput(profile?.user.artistName || profile?.artistName || user?.name || "");
                      setIgInput(profile?.user.instagramHandle || "");
                      setCityInput("");
                      setEditingName(true);
                    }}
                  >
                    <MapPin className="w-3 h-3" />
                    + Add your city
                  </button>
                )}

                {profile?.user.instagramHandle && (
                  <a
                    href={`https://instagram.com/${profile.user.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-white/40 hover:text-red-500 text-sm transition-colors justify-center sm:justify-start"
                  >
                    <Instagram className="w-3 h-3" />
                    @{profile.user.instagramHandle}
                  </a>
                )}
                {!profile?.user.instagramHandle && (
                  <button
                    className="text-white/30 hover:text-white/60 text-xs transition-colors mt-1"
                    onClick={() => {
                      setNameInput(profile?.user.artistName || profile?.artistName || user?.name || "");
                      setIgInput("");
                      setCityInput(userCity || "");
                      setEditingName(true);
                    }}
                  >
                    + Add Instagram handle
                  </button>
                )}
                <div className="mt-2 text-xs text-white/30 uppercase tracking-widest">
                  {user.role === "admin" ? "Admin" : user.role === "judge" ? "Judge" : "Artist"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Lifetime Stats ──────────────────────────────── */}
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

        {/* ── Submission History ──────────────────────────── */}
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
                const isThisPlaying = currentTrack?.url === (sub.submissionType === "youtube" ? sub.youtubeUrl : sub.fileUrl) && isPlaying;
                const hasAudio = sub.submissionType === "youtube" ? !!sub.youtubeUrl : (!!sub.fileKey || !!sub.fileUrl);

                return (
                  <div
                    key={sub.id}
                    className={`border p-4 flex items-center gap-4 transition-all duration-200 ${
                      isThisPlaying
                        ? "border-red-600/60 bg-red-600/5"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    {/* Play button */}
                    <button
                      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center border transition-all ${
                        hasAudio
                          ? "border-red-600/50 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600"
                          : "border-white/10 text-white/20 cursor-not-allowed"
                      }`}
                      onClick={() => hasAudio && handlePlaySubmission(sub)}
                      disabled={!hasAudio}
                      title={hasAudio ? "Play track" : "No audio available"}
                    >
                      {isThisPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

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
      </div>
    </div>
  );
}
