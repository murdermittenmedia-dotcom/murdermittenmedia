import { describe, expect, it, vi } from "vitest";
import {
  ReviewSoundboardAudioEngine,
  MAX_REVIEW_SOUND_BYTES,
  validateReviewSoundUpload,
} from "../client/src/lib/review-soundboard-audio";
import type { ReviewLiveEvent } from "../shared/review-studio";

class FakeSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect = vi.fn();
  disconnect = vi.fn();
  constructor(private context: FakeAudioContext) {}
  start() {
    if (this.context.failStart) throw new Error("start blocked");
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  end() {
    this.onended?.();
  }
}

class FakeAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = {};
  onstatechange: (() => void) | null = null;
  failResume = false;
  failStart = false;
  gain = {
    gain: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  sources: FakeSource[] = [];
  createGain = vi.fn(() => this.gain);
  createBufferSource = vi.fn(() => {
    const source = new FakeSource(this);
    this.sources.push(source);
    return source;
  });
  decodeAudioData = vi.fn(async () => ({ duration: 0.25 }) as AudioBuffer);
  resume = vi.fn(async () => {
    if (this.failResume) throw new Error("autoplay blocked");
    this.state = "running";
    this.onstatechange?.();
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

function soundEvent(
  id: string,
  type: "gift_received" | "manual_sound_triggered" = "gift_received",
  units?: number
): ReviewLiveEvent {
  return {
    id,
    type,
    units,
    sequence: 1,
    timestamp: 1,
    occurrenceId: null,
    submissionId: null,
    soundId: "air-horn",
    soundUrl: "/owned-air-horn.mp3",
    actor: "same-real-user",
  };
}
const settle = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
function setup() {
  const context = new FakeAudioContext();
  const fetchAudio = vi.fn(async () => new ArrayBuffer(8));
  const onStateChange = vi.fn();
  const engine = new ReviewSoundboardAudioEngine({
    createContext: () => context as unknown as AudioContext,
    fetchAudio,
    onStateChange,
  });
  return { engine, context, fetchAudio, onStateChange };
}

function finishAll(context: FakeAudioContext) {
  let index = 0;
  while (index < context.sources.length) {
    context.sources[index++].end();
    if (index > 10_000) throw new Error("Queue did not drain");
  }
}

describe("dedicated review soundboard audio engine", () => {
  it("deduplicates only the same event ID and plays repeated gifts from the same user", async () => {
    const { engine, context, fetchAudio } = setup();
    await engine.enable();
    expect(engine.handleEvent(soundEvent("gift-a"))).toBe(true);
    expect(engine.handleEvent(soundEvent("gift-a"))).toBe(false);
    expect(engine.handleEvent(soundEvent("gift-b"))).toBe(true);
    expect(
      engine.handleEvent(soundEvent("manual-a", "manual_sound_triggered"))
    ).toBe(true);
    await settle();
    expect(context.sources.filter(source => source.started)).toHaveLength(3);
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("plays every gift unit with eight overlapping voices and no dropped queue units", async () => {
    const { engine, context } = setup();
    await engine.enable();
    engine.handleEvent(soundEvent("large-gift", "gift_received", 25));
    engine.handleEvent(soundEvent("next-gift", "gift_received", 2));
    await settle();
    expect(engine.getState()).toMatchObject({ active: 8, queued: 19 });
    finishAll(context);
    expect(context.sources.filter(source => source.started)).toHaveLength(27);
    expect(engine.getState()).toMatchObject({ active: 0, queued: 0 });
    engine.dispose();
  });

  it("defaults missing units to one, rejects malformed counts, and never synthesizes missing audio", async () => {
    const { engine, context, fetchAudio } = setup();
    await engine.enable();
    expect(
      engine.handleEvent({ ...soundEvent("no-url"), soundUrl: undefined })
    ).toBe(false);
    for (const units of [0, -1, 1.5, Infinity])
      expect(
        engine.handleEvent(soundEvent(`bad-${units}`, "gift_received", units))
      ).toBe(false);
    expect(fetchAudio).not.toHaveBeenCalled();
    engine.handleEvent(soundEvent("default-one"));
    await settle();
    expect(context.sources).toHaveLength(1);
    engine.dispose();
  });

  it("stops active nodes, clears the queue, and still accepts future events", async () => {
    const { engine, context } = setup();
    await engine.enable();
    engine.handleEvent(soundEvent("gift-before-stop", "gift_received", 12));
    await settle();
    const playing = context.sources.slice();
    const stop: ReviewLiveEvent = {
      id: "stop-event",
      type: "soundboard_stopped",
      sequence: 2,
      timestamp: 2,
      occurrenceId: null,
      submissionId: null,
    };
    expect(engine.handleEvent(stop)).toBe(true);
    expect(playing.every(source => source.stopped)).toBe(true);
    expect(engine.getState()).toMatchObject({
      ready: true,
      active: 0,
      queued: 0,
    });
    engine.handleEvent(soundEvent("new-after-stop"));
    await settle();
    expect(engine.handleEvent(stop)).toBe(false); // Retried stop cannot silence a newer event.
    expect(
      engine.handleEvent(soundEvent("gift-before-stop", "gift_received", 12))
    ).toBe(false);
    expect(engine.getState()).toMatchObject({ active: 1, queued: 0 });
    expect(context.sources).toHaveLength(9);
    engine.dispose();
  });

  it("never revives a stopped sound when a slow download finishes", async () => {
    const context = new FakeAudioContext();
    let resolve!: (bytes: ArrayBuffer) => void;
    const engine = new ReviewSoundboardAudioEngine({
      createContext: () => context as unknown as AudioContext,
      fetchAudio: () =>
        new Promise(done => {
          resolve = done;
        }),
    });
    await engine.enable();
    engine.handleEvent(soundEvent("slow-download", "gift_received", 3));
    await settle();
    engine.stop();
    resolve(new ArrayBuffer(8));
    await settle();
    expect(context.sources).toHaveLength(0);
    expect(engine.getState().queued).toBe(0);
    engine.handleEvent(soundEvent("future-download"));
    await settle();
    expect(context.sources).toHaveLength(1); // Reuses the decoded cache, but not the old trigger.
    engine.dispose();
  });

  it("reports genuine autoplay failure and resumes all queued units after an explicit retry", async () => {
    const { engine, context, onStateChange } = setup();
    context.failResume = true;
    expect(await engine.enable()).toBe(false);
    engine.handleEvent(soundEvent("blocked-gift", "gift_received", 3));
    await settle();
    expect(engine.getState()).toMatchObject({
      ready: false,
      active: 0,
      queued: 3,
      error: "autoplay blocked",
    });
    expect(context.sources).toHaveLength(0);
    context.failResume = false;
    expect(await engine.enable()).toBe(true);
    await settle();
    expect(engine.getState()).toMatchObject({
      ready: true,
      active: 3,
      queued: 0,
      error: null,
    });
    expect(onStateChange).toHaveBeenCalled();
    engine.dispose();
  });

  it("does not claim readiness when resume resolves but the context stays suspended", async () => {
    const { engine, context } = setup();
    context.resume.mockImplementation(async () => {});
    expect(await engine.enable()).toBe(false);
    expect(engine.getState().ready).toBe(false);
    expect(engine.getState().error).toContain("Audio is blocked");
    engine.dispose();
  });

  it("retains a failed download for explicit retry instead of silently dropping units", async () => {
    const { engine, context, fetchAudio } = setup();
    fetchAudio.mockRejectedValueOnce(new Error("network unavailable"));
    await engine.enable();
    engine.handleEvent(soundEvent("failed-download", "gift_received", 2));
    await settle();
    expect(engine.getState()).toMatchObject({ active: 0, queued: 2 });
    expect(engine.getState().error).toContain("network unavailable");
    await engine.enable();
    await settle();
    expect(context.sources).toHaveLength(2);
    expect(fetchAudio).toHaveBeenCalledTimes(2);
    expect(engine.getState().queued).toBe(0);
    engine.dispose();
  });

  it("retains units when source.start fails and retries without losing counts", async () => {
    const { engine, context } = setup();
    await engine.enable();
    context.failStart = true;
    engine.handleEvent(soundEvent("start-failure", "gift_received", 3));
    await settle();
    expect(engine.getState()).toMatchObject({ active: 0, queued: 3 });
    context.failStart = false;
    await engine.enable();
    expect(context.sources.filter(source => source.started)).toHaveLength(3);
    expect(engine.getState()).toMatchObject({
      active: 3,
      queued: 0,
      error: null,
    });
    engine.dispose();
  });

  it("preloads without playing and applies one shared gain to every manual and gift voice", async () => {
    const { engine, context, fetchAudio } = setup();
    engine.setVolume(0.35);
    await engine.enable();
    await engine.preload(["/owned-air-horn.mp3", "/owned-air-horn.mp3"]);
    expect(context.sources).toHaveLength(0);
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    engine.handleEvent(soundEvent("gift-volume", "gift_received", 2));
    engine.handleEvent(soundEvent("manual-volume", "manual_sound_triggered"));
    await settle();
    engine.setVolume(0.1);
    expect(context.createGain).toHaveBeenCalledTimes(1);
    expect(context.gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.1, 0);
    expect(
      context.sources.every(
        source => source.connect.mock.calls[0][0] === context.gain
      )
    ).toBe(true);
    engine.stop();
    engine.setVolume(0.9);
    expect(context.gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.9, 0);
    engine.dispose();
  });

  it("keeps lifetime deduplication beyond a transport feed's retained history", async () => {
    const { engine, context } = setup();
    for (let index = 0; index < 5002; index++)
      engine.handleEvent(soundEvent(`event-${index}`));
    expect(engine.handleEvent(soundEvent("event-0"))).toBe(false);
    expect(engine.getState().queued).toBe(5002);
    engine.dispose();
    await settle();
    expect(context.sources).toHaveLength(0);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(engine.handleEvent(soundEvent("closed"))).toBe(false);
  });
});

describe("soundboard upload validation", () => {
  it("accepts the four allowed formats with canonical MIME types", () => {
    expect(
      validateReviewSoundUpload(
        { name: "owned.MP3", size: MAX_REVIEW_SOUND_BYTES, type: "audio/mpeg" },
        () => "probably"
      )
    ).toBe("audio/mpeg");
    expect(
      validateReviewSoundUpload({
        name: "owned.wav",
        size: 100,
        type: "audio/x-wav",
      })
    ).toBe("audio/wav");
    expect(
      validateReviewSoundUpload({ name: "owned.m4a", size: 100, type: "" })
    ).toBe("audio/mp4");
    expect(
      validateReviewSoundUpload({
        name: "owned.ogg",
        size: 100,
        type: "audio/ogg",
      })
    ).toBe("audio/ogg");
  });
  it("rejects oversized, empty, mismatched, unsupported, and browser-undecodable files", () => {
    expect(() =>
      validateReviewSoundUpload({
        name: "big.mp3",
        size: MAX_REVIEW_SOUND_BYTES + 1,
        type: "audio/mpeg",
      })
    ).toThrow("20 MiB");
    expect(() =>
      validateReviewSoundUpload({
        name: "empty.wav",
        size: 0,
        type: "audio/wav",
      })
    ).toThrow("empty");
    expect(() =>
      validateReviewSoundUpload({
        name: "disguised.mp3",
        size: 10,
        type: "text/html",
      })
    ).toThrow("does not match");
    expect(() =>
      validateReviewSoundUpload({
        name: "sound.flac",
        size: 10,
        type: "audio/flac",
      })
    ).toThrow("MP3, WAV, M4A, or OGG");
    expect(() =>
      validateReviewSoundUpload(
        { name: "sound.ogg", size: 10, type: "audio/ogg" },
        () => ""
      )
    ).toThrow("cannot decode");
  });
});
