import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { storageGetSignedUrl } from "./storage";

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

export const BEAT_PREVIEW_SECONDS = 30;
export const BEAT_PREVIEW_TAG_SOURCES = ["none", "purchase_now", "purchase_today", "mitten", "custom"] as const;
export type BeatPreviewTagSource = (typeof BEAT_PREVIEW_TAG_SOURCES)[number];

export const DEFAULT_BEAT_PREVIEW_TAGS = {
  purchase_now: {
    label: "Purchase Your Track Now",
    key: "PURCHASEYOURTRACKNOW_637b3856.mp3",
    url: "/manus-storage/PURCHASEYOURTRACKNOW_637b3856.mp3",
    mimeType: "audio/mpeg",
  },
  purchase_today: {
    label: "Purchase Your Track Today",
    key: "PurchaseYourTrackToday_89b31df5.mp3",
    url: "/manus-storage/PurchaseYourTrackToday_89b31df5.mp3",
    mimeType: "audio/mpeg",
  },
  mitten: {
    label: "Murder Mitten Tag",
    key: "MURDERMITTENTAGRMCMIKE_9c7685ca.wav",
    url: "/manus-storage/MURDERMITTENTAGRMCMIKE_9c7685ca.wav",
    mimeType: "audio/wav",
  },
} as const;

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "audio/wav") return "wav";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "mp3";
};

export async function downloadPreviewTag(key: string) {
  const signedUrl = await storageGetSignedUrl(key);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Could not load the selected audio tag.");
  return Buffer.from(await response.arrayBuffer());
}

/** Creates the public 30-second MP3 preview without ever exposing the uploaded master. */
export async function createBeatPreviewClip({
  source,
  mimeType,
  startSeconds,
  tag,
}: {
  source: Buffer;
  mimeType: string;
  startSeconds: number;
  tag?: { audio: Buffer; mimeType: string; atSeconds: number } | null;
}) {
  const tempDirectory = await fs.mkdtemp(join(tmpdir(), "mmm-beat-preview-"));
  const inputPath = join(tempDirectory, `master.${extensionForMimeType(mimeType)}`);
  const outputPath = join(tempDirectory, "preview.mp3");
  const tagPath = tag ? join(tempDirectory, `tag.${extensionForMimeType(tag.mimeType)}`) : null;
  try {
    await fs.writeFile(inputPath, source);
    if (tag && tagPath) await fs.writeFile(tagPath, tag.audio);
    const command = ["-hide_banner", "-loglevel", "error", "-ss", String(startSeconds), "-t", String(BEAT_PREVIEW_SECONDS), "-i", inputPath];
    if (tag && tagPath) {
      command.push("-i", tagPath, "-filter_complex", `[0:a]asetpts=PTS-STARTPTS[beat];[1:a]adelay=${Math.max(0, Math.floor(tag.atSeconds * 1000))}|${Math.max(0, Math.floor(tag.atSeconds * 1000))},volume=1.12[tag];[beat][tag]amix=inputs=2:duration=first:dropout_transition=0[mix]`, "-map", "[mix]");
    }
    command.push("-vn", "-acodec", "libmp3lame", "-b:a", "192k", outputPath);
    await execFileAsync(FFMPEG_PATH, command, { maxBuffer: 2 * 1024 * 1024 });
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
