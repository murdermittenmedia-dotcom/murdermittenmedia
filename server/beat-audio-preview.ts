import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const BEAT_PREVIEW_SECONDS = 30;

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "audio/wav") return "wav";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "mp3";
};

/** Creates the public thirty-second MP3 preview without ever exposing the uploaded master. */
export async function createBeatPreviewClip({
  source,
  mimeType,
  startSeconds,
}: {
  source: Buffer;
  mimeType: string;
  startSeconds: number;
}) {
  const tempDirectory = await fs.mkdtemp(join(tmpdir(), "mmm-beat-preview-"));
  const inputPath = join(tempDirectory, `master.${extensionForMimeType(mimeType)}`);
  const outputPath = join(tempDirectory, "preview.mp3");
  try {
    await fs.writeFile(inputPath, source);
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-ss", String(startSeconds),
      "-t", String(BEAT_PREVIEW_SECONDS),
      "-i", inputPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-b:a", "192k",
      outputPath,
    ], { maxBuffer: 2 * 1024 * 1024 });
    const clip = await fs.readFile(outputPath);
    if (clip.length < 1024) throw new Error("The selected preview point did not produce playable audio.");
    return clip;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview processing failed";
    throw new Error(`Could not make the 30-second preview. Choose a point inside the audio file and try again. (${message})`);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}
