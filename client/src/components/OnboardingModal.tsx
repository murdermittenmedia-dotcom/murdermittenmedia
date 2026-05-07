/* ============================================================
   OnboardingModal — shown after first login
   Collects: artist name + Instagram handle
   ============================================================ */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function OnboardingModal() {
  const { user, refresh } = useAuth();
  const [artistName, setArtistName] = useState(user?.name || "");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState("");

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      refresh();
    },
  });

  // Only show if user is logged in and hasn't completed profile
  if (!user || user.profileComplete || skipped) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!artistName.trim()) { setError("Artist name is required."); return; }
    await updateProfile.mutateAsync({
      artistName: artistName.trim(),
      instagramHandle: instagramHandle.trim() || undefined,
    });
  };

  const handleSkip = async () => {
    // Save with just the display name so profileComplete = true
    await updateProfile.mutateAsync({
      artistName: user.name || "Artist",
      instagramHandle: undefined,
    });
    setSkipped(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-red-600/30 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 uppercase tracking-widest font-semibold">Welcome to Murder Mitten Media</span>
          </div>
          <h2 className="font-['Anton'] text-2xl uppercase">Set Up Your Artist Profile</h2>
          <p className="text-white/50 text-sm mt-1">
            Your profile shows your battle record and song catalogue to the community.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">
              Artist Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={artistName}
              onChange={e => setArtistName(e.target.value)}
              placeholder="Your rap name or artist alias"
              required
              maxLength={128}
              className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 focus:outline-none focus:border-red-600/50 placeholder-white/30"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">
              Instagram Handle
            </label>
            <div className="flex items-center border border-white/10 focus-within:border-red-600/50 bg-white/5">
              <span className="text-white/40 pl-4 pr-1 text-sm select-none">@</span>
              <input
                type="text"
                value={instagramHandle}
                onChange={e => setInstagramHandle(e.target.value.replace(/^@/, ""))}
                placeholder="yourhandle"
                maxLength={64}
                className="flex-1 bg-transparent text-white px-2 py-3 focus:outline-none placeholder-white/30"
              />
            </div>
            <p className="text-white/30 text-xs mt-1">
              Your IG will be linked on your artist popup so fans can follow you.
            </p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 font-['Anton'] text-sm uppercase tracking-widest transition-colors"
            >
              {updateProfile.isPending ? "Saving..." : "Save Profile"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={updateProfile.isPending}
              className="px-5 py-3 border border-white/20 text-white/40 hover:text-white hover:border-white/40 text-xs uppercase tracking-widest transition-colors"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
