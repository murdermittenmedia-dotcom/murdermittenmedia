import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ sockets: [] as any[] }));
vi.mock("socket.io-client", () => ({ io: () => {
  const listeners = new Map<string, (...args: any[]) => void>();
  const socket = { connected: true, on: vi.fn((name, callback) => listeners.set(name, callback)),
    emit: vi.fn(), disconnect: vi.fn(), receive: (name: string, data: any) => listeners.get(name)?.(data) };
  fixtures.sockets.push(socket);
  return socket;
} }));
import { SyncedYouTubePlayer } from "../client/src/components/SyncedYouTubePlayer";

const players: FakePlayer[] = [];
class FakePlayer {
  time = 0; state = 1;
  destroy = vi.fn(); seekTo = vi.fn((time: number) => { this.time = time; });
  playVideo = vi.fn(() => { this.state = 1; }); pauseVideo = vi.fn(() => { this.state = 2; });
  getCurrentTime = () => this.time; getPlayerState = () => this.state;
  getDuration = () => 180; getIframe = () => ({});
  setVolume = vi.fn(); unMute = vi.fn();
  constructor(_host: any, public config: any) {
    players.push(this);
    setTimeout(() => config.events.onReady({ target: this }), 0);
  }
  end() { this.state = 0; this.config.events.onStateChange({ data: 0 }); }
}
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.useFakeTimers(); players.length = 0; fixtures.sockets.length = 0;
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("document", { createElement: () => ({}) });
  vi.stubGlobal("window", { _ytApiReady: true, location: { origin: "http://localhost" }, setInterval, clearInterval,
    YT: { Player: FakePlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } } });
});
afterEach(async () => {
  if (renderer) await act(async () => { renderer!.unmount(); });
  renderer = undefined; vi.useRealTimers(); vi.unstubAllGlobals();
});
async function mount(submissionId: number, onEnded = vi.fn(), maxPlaybackSeconds?: number) {
  await act(async () => {
    renderer = create(React.createElement(SyncedYouTubePlayer, { videoId: "sameVideo01", submissionId,
      isAdmin: true, onEnded, maxPlaybackSeconds }), { createNodeMock: () => ({ replaceChildren: vi.fn() }) });
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return onEnded;
}

describe("actual synchronized YouTube component lifecycle", () => {
  it("replaces consecutive submissions of the same video and destroys only the old player", async () => {
    await mount(1);
    const old = players[0];
    await act(async () => {
      renderer!.update(React.createElement(SyncedYouTubePlayer, { videoId: "sameVideo01", submissionId: 2, isAdmin: true }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(players).toHaveLength(2);
    expect(old.destroy).toHaveBeenCalledTimes(1);
    expect(players[1].destroy).not.toHaveBeenCalled();
    expect(fixtures.sockets[0].emit).toHaveBeenCalledWith("youtube:tick", expect.objectContaining({ submissionId: 2 }));
  });

  it("ignores a delayed end from a destroyed old video and emits the new ending once", async () => {
    const oldEnded = await mount(1);
    const nextEnded = vi.fn();
    await act(async () => {
      renderer!.update(React.createElement(SyncedYouTubePlayer, { videoId: "nextVideo02", submissionId: 2, isAdmin: true, onEnded: nextEnded }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { players[0].end(); players[1].end(); players[1].end(); });
    expect(oldEnded).not.toHaveBeenCalled();
    expect(nextEnded).toHaveBeenCalledTimes(1);
  });

  it("90-second mode completes once and cannot restart the ended video on a late state response", async () => {
    const ended = await mount(1, vi.fn(), 90);
    players[0].time = 90;
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(ended).toHaveBeenCalledTimes(1);
    fixtures.sockets[0].receive("radio:state", { submissionId: 1, currentTime: 91, pausedAt: null });
    expect(players[0].playVideo).not.toHaveBeenCalled();
  });

  it("a paused live song does not advance just because its timer exceeds ninety seconds", async () => {
    const ended = await mount(1, vi.fn(), 90);
    fixtures.sockets[0].receive("radio:state", { submissionId: 1, currentTime: 92, pausedAt: 92 });
    players[0].time = 92;
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(ended).not.toHaveBeenCalled();
  });

  it("full-song mode is not cut off at ninety seconds", async () => {
    const ended = await mount(1);
    players[0].time = 100;
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(ended).not.toHaveBeenCalled();
    expect(fixtures.sockets[0].emit).toHaveBeenCalledWith("youtube:tick", expect.objectContaining({ currentTime: 100, submissionId: 1 }));
  });
});
