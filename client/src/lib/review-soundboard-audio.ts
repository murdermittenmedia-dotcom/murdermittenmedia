import type { ReviewLiveEvent } from "@shared/review-studio";

export const MAX_REVIEW_SOUND_BYTES = 20 * 1024 * 1024;
export const REVIEW_SOUND_ACCEPT =
  ".mp3,.wav,.m4a,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/ogg";

const SOUND_FORMATS: Record<string, { mime: string; aliases: string[] }> = {
  mp3: {
    mime: "audio/mpeg",
    aliases: ["audio/mpeg", "audio/mp3", "audio/x-mp3"],
  },
  wav: {
    mime: "audio/wav",
    aliases: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  },
  m4a: {
    mime: "audio/mp4",
    aliases: ["audio/mp4", "audio/m4a", "audio/x-m4a"],
  },
  ogg: { mime: "audio/ogg", aliases: ["audio/ogg", "application/ogg"] },
};

/** Validate before sending any bytes. This never previews or plays admin audio. */
export function validateReviewSoundUpload(
  file: Pick<File, "name" | "size" | "type">,
  canPlayType?: (mime: string) => string
): string {
  const format = SOUND_FORMATS[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!format)
    throw new Error("Choose an owned or licensed MP3, WAV, M4A, or OGG file.");
  if (file.size <= 0) throw new Error("The sound file is empty.");
  if (file.size > MAX_REVIEW_SOUND_BYTES)
    throw new Error("Sound files must be 20 MiB or smaller.");
  const mime = file.type.toLowerCase().split(";")[0];
  if (
    mime &&
    mime !== "application/octet-stream" &&
    !format.aliases.includes(mime)
  ) {
    throw new Error("The audio file type does not match its extension.");
  }
  if (canPlayType && !canPlayType(format.mime)) {
    throw new Error(
      "This browser cannot decode this audio format. Try MP3 or WAV."
    );
  }
  return format.mime;
}

export function reviewSoundFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this sound file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(","))
        reject(new Error("Could not read this sound file."));
      else resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export type ReviewSoundboardAudioState = {
  ready: boolean;
  active: number;
  queued: number;
  error: string | null;
};

type SoundJob = {
  url: string;
  remaining: number;
  buffer?: AudioBuffer;
  loading: boolean;
  failed: boolean;
};

export type ReviewSoundboardAudioOptions = {
  createContext?: () => AudioContext;
  fetchAudio?: (url: string) => Promise<ArrayBuffer>;
  onStateChange?: (state: ReviewSoundboardAudioState) => void;
};

function createBrowserContext(): AudioContext {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass)
    throw new Error("Web Audio is unavailable in this browser source.");
  return new AudioContextClass({ latencyHint: "interactive" });
}

/** One instance belongs ONLY to the dedicated soundboard source, never an admin or visual preview.
 * Eight overlapping voices + a counted queue preserve every genuine unit without a cooldown.
 * The lifetime event-ID set intentionally has no time/user/sound-based suppression or eviction.
 */
export class ReviewSoundboardAudioEngine {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private volume = 0.7;
  private queue: SoundJob[] = [];
  private active = new Set<AudioBufferSourceNode>();
  private seen = new Set<string>();
  private cache = new Map<string, Promise<AudioBuffer>>();
  private disposed = false;
  private error: string | null = null;
  private pumping = false;
  private readonly createContext: () => AudioContext;
  private readonly fetchAudio: (url: string) => Promise<ArrayBuffer>;
  private readonly onStateChange?: ReviewSoundboardAudioOptions["onStateChange"];
  readonly maxConcurrency = 8;

  constructor(options: ReviewSoundboardAudioOptions = {}) {
    this.createContext = options.createContext ?? createBrowserContext;
    this.fetchAudio =
      options.fetchAudio ??
      (async url => {
        // Media bytes only; backend calls continue to use tRPC. No external sound discovery.
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Sound download failed (${response.status}).`);
        return response.arrayBuffer();
      });
    this.onStateChange = options.onStateChange;
  }

  getState(): ReviewSoundboardAudioState {
    return {
      ready: !this.disposed && this.context?.state === "running",
      active: this.active.size,
      queued: this.queue.reduce((count, job) => count + job.remaining, 0),
      error: this.error,
    };
  }

  private notify() {
    if (!this.disposed) this.onStateChange?.(this.getState());
  }

  private ensureContext(): AudioContext {
    if (this.disposed) throw new Error("Soundboard source is closed.");
    if (!this.context) {
      this.context = this.createContext();
      this.gain = this.context.createGain();
      this.gain.gain.setValueAtTime(this.volume, this.context.currentTime);
      this.gain.connect(this.context.destination);
      this.context.onstatechange = () => {
        this.notify();
        this.pump();
      };
    }
    return this.context;
  }

  /** Invoke directly from a gesture when autoplay is blocked. No silent/fake playback probe. */
  async enable(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      const context = this.ensureContext();
      if (context.state !== "running") await context.resume();
      if (this.disposed) return false;
      if (context.state !== "running")
        throw new Error(
          "Audio is blocked. Enable soundboard audio in this browser source."
        );
      this.error = null;
      // A failed fetch/decode/start keeps its units; an explicit retry tries them again.
      for (const job of this.queue) job.failed = false;
      this.notify();
      this.pump();
      return true;
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : "Could not enable soundboard audio.";
      this.notify();
      return false;
    }
  }

  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.context && this.gain)
      this.gain.gain.setValueAtTime(this.volume, this.context.currentTime);
  }

  private load(url: string): Promise<AudioBuffer> {
    const cached = this.cache.get(url);
    if (cached) return cached;
    const context = this.ensureContext();
    const result = Promise.resolve()
      .then(() => this.fetchAudio(url))
      .then(bytes => context.decodeAudioData(bytes));
    this.cache.set(url, result);
    void result.catch(() => {
      if (this.cache.get(url) === result) this.cache.delete(url);
    });
    return result;
  }

  /** Decode uploaded/assigned sounds ahead of live triggers; never starts playback. */
  async preload(urls: string[]): Promise<void> {
    if (this.disposed) return;
    await Promise.allSettled(
      Array.from(new Set(urls.filter(Boolean))).map(url => {
        try {
          return this.load(url);
        } catch (error) {
          return Promise.reject(error);
        }
      })
    );
  }

  handleEvent(event: ReviewLiveEvent): boolean {
    if (this.disposed || this.seen.has(event.id)) return false;
    if (event.type === "soundboard_stopped") {
      this.seen.add(event.id);
      this.stop();
      return true;
    }
    if (
      event.type !== "manual_sound_triggered" &&
      event.type !== "gift_received"
    )
      return false;
    if (!event.soundUrl) return false;
    const units = event.units ?? 1;
    if (!Number.isSafeInteger(units) || units < 1) return false;
    this.seen.add(event.id);
    this.queue.push({
      url: event.soundUrl,
      remaining: units,
      loading: false,
      failed: false,
    });
    this.notify();
    this.pump();
    return true;
  }

  private pump() {
    if (this.disposed || this.pumping) return;
    this.pumping = true;
    try {
      for (const job of this.queue) {
        if (job.buffer || job.loading || job.failed) continue;
        job.loading = true;
        let loading: Promise<AudioBuffer>;
        try {
          loading = this.load(job.url);
        } catch (error) {
          loading = Promise.reject(error);
        }
        void loading.then(
          buffer => {
            // Stop removes the job. A late decode cannot resurrect stopped audio.
            if (this.disposed || !this.queue.includes(job)) return;
            job.buffer = buffer;
            job.loading = false;
            this.pump();
          },
          error => {
            if (this.disposed || !this.queue.includes(job)) return;
            job.loading = false;
            job.failed = true;
            this.error = `Sound remains queued: ${error instanceof Error ? error.message : "could not decode audio"} Retry soundboard audio to try again.`;
            this.notify();
          }
        );
      }
      if (this.context?.state !== "running" || !this.gain) return;
      // Ready buffers may pass an in-flight download, avoiding head-of-line blocking.
      for (const job of [...this.queue]) {
        if (!job.buffer || job.failed) continue;
        while (job.remaining > 0 && this.active.size < this.maxConcurrency) {
          let source: AudioBufferSourceNode | null = null;
          try {
            source = this.context.createBufferSource();
            source.buffer = job.buffer;
            source.connect(this.gain);
            this.active.add(source);
            source.onended = () => {
              this.active.delete(source!);
              source?.disconnect();
              this.pump();
              this.notify();
            };
            source.start();
            job.remaining--;
          } catch (error) {
            if (source) {
              source.onended = null;
              this.active.delete(source);
              source.disconnect();
            }
            job.failed = true;
            this.error = `Sound remains queued: ${error instanceof Error ? error.message : "playback failed"} Retry soundboard audio to try again.`;
            break;
          }
        }
        if (job.remaining === 0) this.queue.splice(this.queue.indexOf(job), 1);
        if (this.active.size >= this.maxConcurrency) break;
      }
    } finally {
      this.pumping = false;
      this.notify();
    }
  }

  /** Stops only this channel; never mutes music or disables any future trigger. */
  stop() {
    this.queue = [];
    for (const source of Array.from(this.active)) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* An already-ended node is safe to discard. */
      }
      source.disconnect();
    }
    this.active.clear();
    this.error = null;
    this.notify();
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.cache.clear();
    if (this.context) {
      this.context.onstatechange = null;
      if (this.context.state !== "closed")
        void this.context.close().catch(() => {});
    }
    this.gain?.disconnect();
  }
}
