import ReviewTikTokConnection from "./ReviewTikTokConnection";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useReviewLiveEvents } from "@/hooks/useReviewLiveEvents";
import { trpc } from "@/lib/trpc";
import {
  REVIEW_SOUND_ACCEPT,
  reviewSoundFileBase64,
  validateReviewSoundUpload,
} from "@/lib/review-soundboard-audio";
import {
  REVIEW_SOURCE_PATHS,
  type ReviewSound,
  type ReviewStudioSettings,
} from "@shared/review-studio";
import { Copy, Radio, Square, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";

type SettingsPatch = Partial<
  Pick<
    ReviewStudioSettings,
    | "musicVolume"
    | "soundboardVolume"
    | "submissionAlertsEnabled"
    | "giftMappings"
    | "tiktokEnabled"
    | "tiktokRoomId"
  >
>;
type GiftMapping = ReviewStudioSettings["giftMappings"][number];

/** Mount once inside the existing admin review audio area. This replaces its old
 * MUSIC slider rather than adding a third master control. No local sound playback.
 */
export default function ReviewStudioControls({
  className = "",
}: {
  className?: string;
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading studio controls…</p>
    );
  if (user?.role !== "admin") return null;
  return <AdminReviewStudioControls className={className} />;
}

function AdminReviewStudioControls({ className }: { className: string }) {
  const utils = trpc.useUtils();
  const { settings, connected, isLoading, isError } = useReviewLiveEvents();
  const { setVolume } = useAudioPlayer();
  const status = trpc.reviewStudio.status.useQuery(undefined, {
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });
  const setSettings = trpc.reviewStudio.setSettings.useMutation();
  const uploadSound = trpc.reviewStudio.uploadSound.useMutation();
  const triggerSound = trpc.reviewStudio.triggerSound.useMutation({
    onError: error => toast.error(error.message),
  });
  const stopSoundboard = trpc.reviewStudio.stopSoundboard.useMutation({
    onSuccess: () =>
      toast.success("Soundboard stopped. Future triggers remain enabled."),
    onError: error => toast.error(error.message),
  });
  const [volumes, setVolumes] = useState({
    musicVolume: settings.musicVolume,
    soundboardVolume: settings.soundboardVolume,
  });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<GiftMapping[]>([]);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef<SettingsPatch>({});
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const flushRef = useRef<() => void>(() => {});
  const sourceUrl =
    typeof window === "undefined"
      ? REVIEW_SOURCE_PATHS.soundboard
      : `${window.location.origin}${REVIEW_SOURCE_PATHS.soundboard}`;

  useEffect(() => {
    if (!inFlight.current && !Object.keys(pending.current).length) {
      setVolumes({
        musicVolume: settings.musicVolume,
        soundboardVolume: settings.soundboardVolume,
      });
      setVolume(settings.musicVolume);
    }
  }, [settings.musicVolume, settings.soundboardVolume, setVolume, saving]);
  useEffect(() => {
    if (!mappingDirty)
      setMappings(
        settings.giftMappings.length
          ? settings.giftMappings.map(item => ({ ...item }))
          : settings.sounds.map(sound => ({ giftId: "", soundId: sound.id }))
      );
  }, [settings.giftMappings, settings.sounds, mappingDirty]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      // Flush a last slider movement, even if navigation precedes the debounce.
      flushRef.current();
    };
  }, []);

  // Serialize partial settings writes so quick slider movements cannot arrive out of order.
  const flush = async () => {
    if (inFlight.current || !Object.keys(pending.current).length) return;
    const patch = pending.current;
    pending.current = {};
    inFlight.current = true;
    if (mounted.current) setSaving(true);
    try {
      const updated = await setSettings.mutateAsync(patch);
      utils.reviewStudio.settings.setData(undefined, updated);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save studio settings."
      );
      void utils.reviewStudio.settings.invalidate();
      if (mounted.current && !Object.keys(pending.current).length) {
        setVolumes({
          musicVolume: settings.musicVolume,
          soundboardVolume: settings.soundboardVolume,
        });
        setVolume(settings.musicVolume);
      }
    } finally {
      inFlight.current = false;
      if (Object.keys(pending.current).length) flushRef.current();
      else if (mounted.current) setSaving(false);
    }
  };
  flushRef.current = () => {
    void flush();
  };
  const savePatch = (patch: SettingsPatch, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    if (immediate) flushRef.current();
    else timer.current = setTimeout(() => flushRef.current(), 160);
  };
  const changeVolume = (
    key: "musicVolume" | "soundboardVolume",
    value: number
  ) => {
    setVolumes(previous => ({ ...previous, [key]: value }));
    if (key === "musicVolume") setVolume(value);
    savePatch({ [key]: value });
  };

  const upload = async (sound: ReviewSound, file: File | undefined) => {
    if (!file) return;
    if (!rightsConfirmed) {
      toast.error("Confirm you own or license the sound before uploading.");
      return;
    }
    setUploadingId(sound.id);
    try {
      const probe = document.createElement("audio"); // Codec validation only; never plays.
      const mimeType = validateReviewSoundUpload(file, mime =>
        probe.canPlayType(mime)
      );
      const updated = await uploadSound.mutateAsync({
        id: sound.id,
        label: sound.label,
        fileName: file.name,
        mimeType,
        fileBase64: await reviewSoundFileBase64(file),
      });
      utils.reviewStudio.settings.setData(undefined, updated);
      toast.success(`${sound.label} is ready for the broadcast source.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Sound upload failed."
      );
    } finally {
      setUploadingId(null);
    }
  };
  const saveMappings = async () => {
    const filled = mappings
      .map(mapping => ({
        giftId: mapping.giftId.trim(),
        soundId: mapping.soundId,
      }))
      .filter(mapping => mapping.giftId);
    if (new Set(filled.map(mapping => mapping.giftId)).size !== filled.length) {
      toast.error("Map each gift ID only once.");
      return;
    }
    if (filled.some(mapping => !/^\d+$/.test(mapping.giftId))) {
      toast.error(
        "Enter the real numeric TikTok gift ID from your verified connector."
      );
      return;
    }
    if (
      filled.some(
        mapping => !settings.sounds.some(sound => sound.id === mapping.soundId)
      )
    ) {
      toast.error("Choose an existing sound for each gift ID.");
      return;
    }
    try {
      // Volume writes are flushed before saving the separate mapping data.
      await flush();
      const updated = await setSettings.mutateAsync({ giftMappings: filled });
      utils.reviewStudio.settings.setData(undefined, updated);
      setMappingDirty(false);
      toast.success(
        "Gift mappings saved. Unuploaded sounds remain silent until a file is assigned."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save gift mappings."
      );
    }
  };
  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl);
      toast.success("Soundboard audio source URL copied.");
    } catch {
      toast.error("Copy the displayed soundboard source URL manually.");
    }
  };

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        Loading soundboard settings…
      </p>
    );
  return (
    <section
      aria-label="Review studio audio controls"
      className={`space-y-5 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5 ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Volume2 className="size-5 text-primary" /> Review studio audio
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Two independent master channels. Effects play only through your
            dedicated broadcast source.
          </p>
        </div>
        <span className="text-xs text-muted-foreground" role="status">
          {saving
            ? "Saving…"
            : connected
              ? "Live settings connected"
              : "Polling live settings"}
        </span>
      </header>
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Live event connection is unavailable. Reconnecting automatically.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["musicVolume", "soundboardVolume"] as const).map(key => (
          <div key={key} className="rounded-lg border border-border p-4">
            <label
              htmlFor={`review-master-${key}`}
              className="flex items-center justify-between text-sm font-black tracking-wider"
            >
              <span>{key === "musicVolume" ? "MUSIC" : "SOUNDBOARD"}</span>
              <output htmlFor={`review-master-${key}`} className="text-primary">
                {Math.round(volumes[key] * 100)}%
              </output>
            </label>
            <input
              id={`review-master-${key}`}
              aria-label={key === "musicVolume" ? "MUSIC" : "SOUNDBOARD"}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volumes[key]}
              onChange={event =>
                changeVolume(key, Number(event.currentTarget.value))
              }
              onPointerUp={() => flushRef.current()}
              onKeyUp={() => flushRef.current()}
              onBlur={() => flushRef.current()}
              className="mt-4 w-full accent-primary focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-semibold">
            <Radio className="size-4" /> One broadcast audio source
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copySource}
          >
            <Copy /> Copy URL
          </Button>
        </div>
        <Input
          value={sourceUrl}
          readOnly
          aria-label="Soundboard browser source URL"
          onFocus={event => event.currentTarget.select()}
          className="font-mono text-xs"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Add this URL once as an OBS / supported LIVE Studio browser source
          (320 × 100). Route its audio to the broadcast output and enable audio
          in that source if prompted. Keep it active when hidden. No audio
          iframe is embedded in this preview or any visual overlay.
        </p>
        <p
          role="status"
          className={`text-xs ${status.data && status.data.audioSources > 1 ? "text-amber-400" : "text-muted-foreground"}`}
        >
          {status.isError
            ? "Audio-source status unavailable; check that the browser source is active."
            : !status.data
              ? "Checking active audio sources…"
              : status.data.audioSources > 1
                ? `Warning: ${status.data.audioSources} audio sources are active. Remove extra sources to prevent echo; gift events are not discarded.`
                : status.data.audioSources === 1
                  ? "One audio source active."
                  : "No active audio source. Add the URL to your broadcast software before triggering sounds."}
        </p>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={event => setRightsConfirmed(event.currentTarget.checked)}
          className="mt-0.5 accent-primary"
        />
        <span>
          I own or have a license to broadcast the files I upload. MP3 / WAV /
          M4A / OGG, up to 20 MiB each. No unverified stock sounds are supplied.
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {settings.sounds.map(sound => (
          <div
            key={sound.id}
            className="space-y-2 rounded-lg border border-border p-2"
          >
            <Button
              type="button"
              variant={sound.url ? "default" : "secondary"}
              disabled={!sound.url}
              onClick={() =>
                triggerSound.mutate({
                  soundId: sound.id,
                  requestId: crypto.randomUUID(),
                })
              }
              className="h-20 w-full whitespace-normal px-2 text-base font-bold transition-transform active:scale-[0.97]"
            >
              {sound.label}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {sound.url
                ? "Ready · broadcast source only"
                : "Upload a sound to enable"}
            </p>
            <label
              className={`flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-2 text-xs focus-within:ring-2 focus-within:ring-primary ${uploadingId || !rightsConfirmed ? "cursor-not-allowed opacity-50" : "hover:bg-accent"}`}
            >
              <Upload className="size-3.5" />
              {uploadingId === sound.id
                ? "Uploading…"
                : sound.url
                  ? "Replace audio"
                  : "Upload audio"}
              <input
                type="file"
                className="sr-only"
                accept={REVIEW_SOUND_ACCEPT}
                aria-label={`${sound.url ? "Replace" : "Upload"} ${sound.label} audio`}
                disabled={!!uploadingId || !rightsConfirmed}
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void upload(sound, file);
                }}
              />
            </label>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="destructive"
        className="w-full sm:w-auto"
        disabled={stopSoundboard.isPending}
        onClick={() => stopSoundboard.mutate()}
      >
        <Square /> Stop soundboard audio
      </Button>
      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="font-semibold">TikTok gift → sound</h4>
        <p className="text-xs text-muted-foreground">
          Enter actual gift IDs from the verified connector. Blank rows are not
          mapped. Each genuine event/unit uses the same audio source as manual
          clicks, with no cooldown or per-user throttling.
        </p>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {mappings.map((mapping, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <Input
                aria-label={`Real TikTok gift ID ${index + 1}`}
                inputMode="numeric"
                placeholder="Actual gift ID"
                value={mapping.giftId}
                onChange={event => {
                  const value = event.currentTarget.value;
                  setMappingDirty(true);
                  setMappings(rows =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, giftId: value } : row
                    )
                  );
                }}
              />
              <select
                aria-label={`Mapped sound ${index + 1}`}
                value={mapping.soundId}
                onChange={event => {
                  const value = event.currentTarget.value;
                  setMappingDirty(true);
                  setMappings(rows =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, soundId: value } : row
                    )
                  );
                }}
                className="min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                {settings.sounds.map(sound => (
                  <option key={sound.id} value={sound.id}>
                    {sound.label}
                    {!sound.url ? " (needs upload)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setMappingDirty(true);
              setMappings(rows => [
                ...rows,
                { giftId: "", soundId: settings.sounds[0]?.id ?? "air-horn" },
              ]);
            }}
          >
            Add mapping
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!mappingDirty || setSettings.isPending}
            onClick={() => void saveMappings()}
          >
            Save gift mappings
          </Button>
        </div>
      </div>
      <ReviewTikTokConnection />
    </section>
  );
}

export { ReviewStudioControls };
