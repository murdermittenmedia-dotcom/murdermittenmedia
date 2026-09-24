/* ============================================================
   ProfileCompletionModal — shared fresh-account and upload gate
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Camera, MapPin, X } from "lucide-react";
import { toast } from "sonner";

export const PROFILE_COMPLETION_EVENT = "mmm:open-profile-completion";

type ProfileCompletionRequest = { required?: boolean };

export function requestProfileCompletion(options: ProfileCompletionRequest = {}) {
  window.dispatchEvent(new CustomEvent<ProfileCompletionRequest>(PROFILE_COMPLETION_EVENT, { detail: options }));
}

export function OnboardingModal() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [city, setCity] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !user.profileComplete) {
      setArtistName((current) => current || user.artistName || user.name || "");
      setOpen(true);
    }
  }, [user]);

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<ProfileCompletionRequest>).detail ?? {};
      setRequired(detail.required ?? true);
      setArtistName((current) => current || user?.artistName || user?.name || "");
      setOpen(true);
    };
    window.addEventListener(PROFILE_COMPLETION_EVENT, handleRequest);
    return () => window.removeEventListener(PROFILE_COMPLETION_EVENT, handleRequest);
  }, [user]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await refresh();
      setOpen(false);
      setRequired(false);
      toast.success("Profile completed. You can upload now.");
    },
    onError: (err) => setError(err.message),
  });

  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarPreview(data.avatarUrl);
      toast.success("Profile picture added.");
    },
    onError: (err) => setError(`Profile picture upload failed: ${err.message}`),
  });

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Use a JPG, PNG, WebP, or GIF profile picture.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Profile picture must be under 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      setAvatarPreview(result);
      uploadAvatar.mutate({
        base64: result.split(",")[1],
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!artistName.trim()) {
      setError("Stage name is required to complete your profile.");
      return;
    }
    await updateProfile.mutateAsync({
      artistName: artistName.trim(),
      instagramHandle: instagramHandle.trim().replace(/^@/, "") || undefined,
      city: city.trim() || undefined,
    });
  };

  const handleSkip = () => {
    setOpen(false);
    setRequired(false);
  };

  if (!user || !open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg border border-red-600/30 bg-[#111] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /><span className="text-xs font-semibold uppercase tracking-widest text-red-400">{required ? "Before you upload" : "Welcome to Murder Mitten Media"}</span></div>
            <h2 className="font-['Anton'] text-3xl uppercase">Complete your profile</h2>
            <p className="mt-2 max-w-md text-sm text-white/50">Add your public artist information once. It will appear on your profile, catalogue, and activity across the site.</p>
          </div>
          {!required && <button type="button" onClick={handleSkip} className="text-white/35 hover:text-white" aria-label="Close profile setup"><X className="h-5 w-5" /></button>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="flex items-center gap-4 border border-white/10 bg-white/[.03] p-4">
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-red-600/50 bg-red-600/15" aria-label="Choose profile picture">
              {avatarPreview || user.avatarUrl ? <img src={avatarPreview || user.avatarUrl || ""} alt="Profile preview" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7 text-red-400" />}
              <span className="absolute inset-0 grid place-items-center bg-black/60 text-[9px] font-black uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">Change</span>
            </button>
            <div><p className="text-xs font-black uppercase tracking-widest text-white/75">Profile picture</p><p className="mt-1 text-xs leading-relaxed text-white/40">JPG, PNG, WebP, or GIF. Optional, but recommended for discovery.</p><input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} /></div>
          </div>

          <div><label className="mb-1.5 block text-xs uppercase tracking-widest text-white/50">Stage name <span className="text-red-500">*</span></label><input value={artistName} onChange={(event) => setArtistName(event.target.value)} placeholder="Your rap name or artist alias" required maxLength={128} className="w-full border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-red-600/50" /></div>
          <div><label className="mb-1.5 block text-xs uppercase tracking-widest text-white/50">City / hometown</label><div className="flex items-center border border-white/10 bg-white/5 focus-within:border-red-600/50"><MapPin className="ml-3 h-4 w-4 shrink-0 text-white/30" /><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Detroit, MI" maxLength={128} className="flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-white/30" /></div></div>
          <div><label className="mb-1.5 block text-xs uppercase tracking-widest text-white/50">Instagram handle</label><div className="flex items-center border border-white/10 bg-white/5 focus-within:border-red-600/50"><span className="pl-4 pr-1 text-sm text-white/40">@</span><input value={instagramHandle} onChange={(event) => setInstagramHandle(event.target.value.replace(/^@/, ""))} placeholder="yourhandle" maxLength={64} className="flex-1 bg-transparent px-2 py-3 text-white outline-none placeholder:text-white/30" /></div></div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="submit" disabled={updateProfile.isPending || uploadAvatar.isPending} className="flex-1 bg-red-600 py-3 font-['Anton'] text-sm uppercase tracking-widest text-white transition hover:bg-red-500 disabled:opacity-40">{updateProfile.isPending ? "Saving..." : "Save Profile"}</button>{!required && <button type="button" onClick={handleSkip} disabled={updateProfile.isPending} className="border border-white/20 px-5 py-3 text-xs uppercase tracking-widest text-white/45 transition hover:border-white/40 hover:text-white">Not now</button>}</div>
        </form>
      </div>
    </div>
  );
}

export { OnboardingModal as ProfileCompletionModal };

export default OnboardingModal;
