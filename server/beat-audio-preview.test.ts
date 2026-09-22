import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { BEAT_PREVIEW_SECONDS, createBeatPreviewClip } from "./beat-audio-preview";

const folder = await fs.mkdtemp(join(tmpdir(), "mmm-preview-test-"));
afterAll(async () => { await fs.rm(folder, { recursive: true, force: true }); });

describe("one-file Beat Marketplace previews", () => {
  it("renders a public thirty-second MP3 preview from the uploaded master", async () => {
    const masterPath = join(folder, "master.wav");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "35", masterPath]);
    const master = await fs.readFile(masterPath);
    const preview = await createBeatPreviewClip({ source: master, mimeType: "audio/wav", startSeconds: 3 });
    expect(BEAT_PREVIEW_SECONDS).toBe(30);
    expect(preview.length).toBeGreaterThan(250_000);
    expect(preview.subarray(0, 3).toString()).toBe("ID3");
  });

  it("mixes a selected preview tag at the requested timestamp without changing preview length", async () => {
    const masterPath = join(folder, "tag-master.wav");
    const tagPath = join(folder, "tag.wav");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "34", masterPath]);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=44100", "-t", "2", tagPath]);
    const [master, tag] = await Promise.all([fs.readFile(masterPath), fs.readFile(tagPath)]);
    const preview = await createBeatPreviewClip({ source: master, mimeType: "audio/wav", startSeconds: 1, tag: { audio: tag, mimeType: "audio/wav", atSeconds: 17 } });
    expect(preview.subarray(0, 3).toString()).toBe("ID3");
    expect(preview.length).toBeGreaterThan(250_000);
  });
});
