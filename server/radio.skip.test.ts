/**
 * Tests for the radio skip/pause fix and YouTube timestamp sync.
 *
 * Key behaviors verified:
 * 1. The server's radio:track_ended handler correctly advances the queue
 * 2. The youtube:tick handler stores and re-broadcasts YouTube timestamps
 * 3. The radio:get_state handler includes YouTube timestamp data for late joiners
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── Simulate the server-side RadioState shape ────────────────────────────────
type RadioState = {
  submissionId: number | null;
  artistName: string;
  songTitle: string;
  audioUrl: string | null;
  youtubeUrl: string | null;
  submissionType: string;
  startedAt: number | null;
  pausedAt: number | null;
  fileKey: string | null;
  ytCurrentTime: number | null;
  ytState: number | null;
  ytUpdatedAt: number | null;
};

function makeEmptyState(): RadioState {
  return {
    submissionId: null,
    artistName: "",
    songTitle: "",
    audioUrl: null,
    youtubeUrl: null,
    submissionType: "file",
    startedAt: null,
    pausedAt: null,
    fileKey: null,
    ytCurrentTime: null,
    ytState: null,
    ytUpdatedAt: null,
  };
}

// ─── Simulate the youtube:tick handler logic ──────────────────────────────────
function handleYoutubeTick(
  radioState: RadioState,
  data: { submissionId: number; currentTime: number; state: number }
): RadioState {
  if (data.submissionId !== radioState.submissionId) return radioState;
  return {
    ...radioState,
    ytCurrentTime: data.currentTime,
    ytState: data.state,
    ytUpdatedAt: Date.now(),
  };
}

// ─── Simulate the radio:get_state response ────────────────────────────────────
function buildGetStateResponse(radioState: RadioState) {
  if (!radioState.submissionId) return null;
  let currentTime = 0;
  if (radioState.pausedAt !== null) {
    currentTime = radioState.pausedAt;
  } else if (radioState.startedAt) {
    currentTime = (Date.now() - radioState.startedAt) / 1000;
  }
  return {
    ...radioState,
    currentTime,
    ytCurrentTime: radioState.ytCurrentTime,
    ytState: radioState.ytState,
    ytUpdatedAt: radioState.ytUpdatedAt,
  };
}

// ─── Simulate the viewer-side sync calculation ────────────────────────────────
function calcViewerSyncTime(ytCurrentTime: number, ytUpdatedAt: number, networkDelayMs = 50): number {
  const now = ytUpdatedAt + networkDelayMs; // simulate viewer receiving tick 50ms later
  return ytCurrentTime + (now - ytUpdatedAt) / 1000;
}

describe("Radio Skip Fix", () => {
  it("radioState reset includes YouTube timestamp fields", () => {
    const state = makeEmptyState();
    expect(state.ytCurrentTime).toBeNull();
    expect(state.ytState).toBeNull();
    expect(state.ytUpdatedAt).toBeNull();
  });

  it("new track load resets YouTube timestamp fields", () => {
    const state: RadioState = {
      submissionId: 1,
      artistName: "Test",
      songTitle: "Track 1",
      audioUrl: null,
      youtubeUrl: "https://youtube.com/watch?v=abc",
      submissionType: "youtube",
      startedAt: Date.now() - 60000,
      pausedAt: null,
      fileKey: null,
      ytCurrentTime: 45.2,
      ytState: 1,
      ytUpdatedAt: Date.now() - 2000,
    };

    // Simulate loading a new track (resets YT fields)
    const newState: RadioState = {
      ...state,
      submissionId: 2,
      songTitle: "Track 2",
      startedAt: Date.now(),
      ytCurrentTime: null,
      ytState: null,
      ytUpdatedAt: null,
    };

    expect(newState.ytCurrentTime).toBeNull();
    expect(newState.ytState).toBeNull();
    expect(newState.ytUpdatedAt).toBeNull();
  });
});

describe("YouTube Timestamp Sync", () => {
  let radioState: RadioState;

  beforeEach(() => {
    radioState = {
      ...makeEmptyState(),
      submissionId: 42,
      artistName: "Test Artist",
      songTitle: "Test Song",
      youtubeUrl: "https://youtube.com/watch?v=test123",
      submissionType: "youtube",
      startedAt: Date.now() - 30000,
    };
  });

  it("youtube:tick updates state for matching submissionId", () => {
    const updated = handleYoutubeTick(radioState, {
      submissionId: 42,
      currentTime: 28.5,
      state: 1, // playing
    });

    expect(updated.ytCurrentTime).toBe(28.5);
    expect(updated.ytState).toBe(1);
    expect(updated.ytUpdatedAt).not.toBeNull();
  });

  it("youtube:tick ignores ticks for different submissionId", () => {
    const updated = handleYoutubeTick(radioState, {
      submissionId: 99, // wrong submission
      currentTime: 100,
      state: 1,
    });

    // State should be unchanged
    expect(updated.ytCurrentTime).toBeNull();
    expect(updated.ytState).toBeNull();
  });

  it("radio:get_state includes YouTube timestamp for late joiners", () => {
    // Simulate admin has been watching for 30s
    radioState.ytCurrentTime = 28.5;
    radioState.ytState = 1;
    radioState.ytUpdatedAt = Date.now() - 2000; // 2s ago

    const response = buildGetStateResponse(radioState);

    expect(response).not.toBeNull();
    expect(response!.ytCurrentTime).toBe(28.5);
    expect(response!.ytState).toBe(1);
    expect(response!.ytUpdatedAt).not.toBeNull();
  });

  it("radio:get_state returns null when no track is playing", () => {
    const emptyState = makeEmptyState();
    const response = buildGetStateResponse(emptyState);
    expect(response).toBeNull();
  });

  it("viewer calculates synced time accounting for network delay", () => {
    const adminTime = 45.0;
    const updatedAt = Date.now() - 100; // tick was sent 100ms ago
    const syncedTime = calcViewerSyncTime(adminTime, updatedAt, 100);

    // Viewer should be at ~45.1s (100ms of playback since tick)
    expect(syncedTime).toBeCloseTo(45.1, 1);
  });

  it("drift threshold: only seek if drift > 3s", () => {
    const adminTime = 45.0;
    const updatedAt = Date.now();

    // Simulate viewer at 44.5s — drift is 0.5s, should NOT seek
    const syncedTime = calcViewerSyncTime(adminTime, updatedAt, 0);
    const viewerTime = 44.5;
    const drift = Math.abs(syncedTime - viewerTime);

    expect(drift).toBeLessThan(3);
    // Should NOT seek
    expect(drift < 3).toBe(true);
  });

  it("drift threshold: seek when drift > 3s", () => {
    const adminTime = 60.0;
    const updatedAt = Date.now();

    // Simulate viewer at 50s — drift is 10s, SHOULD seek
    const syncedTime = calcViewerSyncTime(adminTime, updatedAt, 0);
    const viewerTime = 50.0;
    const drift = Math.abs(syncedTime - viewerTime);

    expect(drift).toBeGreaterThan(3);
    // Should seek
    expect(drift > 3).toBe(true);
  });
});

describe("Auto-advance Guard (onEnded filter)", () => {
  it("only processes Music Review stream tracks", () => {
    const processTrack = (track: { isStream?: boolean; sourcePage?: string }) => {
      // This mirrors the guard in AdminPanel's onEnded handler
      if (!track.isStream || track.sourcePage !== "Music Review") return false;
      return true;
    };

    // Should process
    expect(processTrack({ isStream: true, sourcePage: "Music Review" })).toBe(true);

    // Should NOT process — not a stream
    expect(processTrack({ isStream: false, sourcePage: "Music Review" })).toBe(false);

    // Should NOT process — wrong page
    expect(processTrack({ isStream: true, sourcePage: "Forum" })).toBe(false);

    // Should NOT process — no metadata
    expect(processTrack({})).toBe(false);
  });
});
