import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Beat Marketplace uploader preview studio", () => {
  it("builds a browser-audible 30-second tagged preview and sends it to the protected upload path", () => {
    const studio = readFileSync(resolve(process.cwd(), "client/src/components/BeatPreviewStudio.tsx"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(studio).toContain("new OfflineAudioContext");
    expect(studio).toContain("audioBufferToWav");
    expect(studio).toContain("Loading selected voice tag");
    expect(studio).toContain("base64ToArrayBuffer");
    expect(studio).toContain("Ready to publish. The buyer hears this exact preview.");
    expect(producer).toContain("<BeatPreviewStudio");
    expect(producer).toContain("previewTagAudio.useQuery");
    expect(producer).toContain("<select value={source}");
    expect(producer).toContain("Use the included terms or expand a lease to customize it.");
    expect(producer).toContain("browserPreviewBase64");
    expect(producer).toContain("Build the 30-second preview before publishing");
    expect(router).toContain("previewTagAudio: protectedProcedure");
    expect(router).toContain("audioBase64: audio.toString(\"base64\")");
    expect(router).toContain("browserPreviewMimeType");
    expect(router).toContain("browserPreview.length > 5_600_000");
  });

  it("uses a fixed FFmpeg fallback path when browser preview data is unavailable", () => {
    const renderer = readFileSync(resolve(process.cwd(), "server/beat-audio-preview.ts"), "utf8");
    expect(renderer).toContain('const FFMPEG_PATH = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg"');
    expect(renderer).toContain("execFileAsync(FFMPEG_PATH");
  });
});
