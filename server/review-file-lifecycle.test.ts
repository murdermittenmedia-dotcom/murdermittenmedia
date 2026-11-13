import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioPlayerProvider, useAudioPlayer } from "../client/src/contexts/AudioPlayerContext";

let audio: FakeAudio;
class FakeAudio extends EventTarget {
  private source = "";
  preload = "none"; volume = 1; muted = false; paused = true; ended = false;
  currentTime = 0; duration = 180; readyState = 4;
  get src() { return this.source.startsWith("data:") ? this.source : new URL(this.source, "http://localhost").href; }
  set src(value: string) { this.source = value; this.ended = false; }
  load() { this.ended = false; this.currentTime = 0; }
  async play() { this.paused = false; this.dispatchEvent(new Event("play")); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  finish() { this.ended = true; this.paused = true; this.dispatchEvent(new Event("ended")); }
  removeAttribute() { this.source = ""; }
  constructor() { super(); audio = this; }
}
let player: ReturnType<typeof useAudioPlayer>;
let renderer: ReactTestRenderer;
let unsubscribe: (() => void) | undefined;
function Probe() { player = useAudioPlayer(); return null; }
beforeEach(async () => {
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("window", { location: { origin: "http://localhost" } });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(async () => { renderer = create(React.createElement(AudioPlayerProvider, null, React.createElement(Probe))); });
});
afterEach(async () => {
  unsubscribe?.(); unsubscribe = undefined;
  await act(async () => { renderer.unmount(); });
  vi.unstubAllGlobals();
});

describe("actual uploaded-audio provider endings", () => {
  it("notifies the live queue when a relative storage audio URL ends naturally", async () => {
    const ended = vi.fn(); unsubscribe = player.onEnded(ended);
    await act(async () => { player.play({ url: "/manus-storage/live.mp3", title: "Live song", isStream: true, sourcePage: "Music Review", submissionId: 1 }); });
    await act(async () => { audio.finish(); });
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ submissionId: 1 }));
  });
  it("does not complete the new track when a previous source emits a delayed ended event", async () => {
    const ended = vi.fn(); unsubscribe = player.onEnded(ended);
    await act(async () => { player.play({ url: "https://audio.example/one.mp3", title: "One", submissionId: 1 }); });
    await act(async () => { player.play({ url: "https://audio.example/two.mp3", title: "Two", submissionId: 2 }); });
    await act(async () => { audio.dispatchEvent(new Event("ended")); });
    expect(ended).not.toHaveBeenCalled();
    await act(async () => { audio.finish(); });
    expect(ended).toHaveBeenCalledWith(expect.objectContaining({ submissionId: 2 }));
  });
});
