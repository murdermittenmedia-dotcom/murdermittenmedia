import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { ReviewIdentity } from "./review-submission-identity";
import { storagePut } from "./storage";

export const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const encodedLimit = (bytes: number) => 4 * Math.ceil(bytes / 3);
export const paymentProofUploadSchema = z.object({
  fileName: z.string().min(1).max(256),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  imageBase64: z.string().min(1).max(encodedLimit(MAX_PAYMENT_PROOF_BYTES)),
});

function invalid(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
export function decodeStrictBase64(value: string, maxBytes: number) {
  if (value.length > encodedLimit(maxBytes)) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File exceeds the upload size limit." });
  if (!value || value.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) invalid("Upload must contain valid base64 file bytes, without a data URL prefix.");
  const buffer = Buffer.from(value, "base64");
  if (!buffer.length || buffer.toString("base64") !== value) invalid("Upload must contain canonical base64 file bytes.");
  if (buffer.length > maxBytes) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File exceeds the upload size limit." });
  return buffer;
}
const extension = (name: string) => name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
export function validatePaymentProof(input: z.infer<typeof paymentProofUploadSchema>) {
  const bytes = decodeStrictBase64(input.imageBase64, MAX_PAYMENT_PROOF_BYTES);
  const ext = extension(input.fileName);
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR";
  const jpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const webp = bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16)) && bytes.readUInt32LE(4) + 8 === bytes.length;
  if (input.mimeType === "image/png" && ext === "png" && png) return { bytes, ext: "png" as const };
  if (input.mimeType === "image/jpeg" && ["jpg", "jpeg"].includes(ext ?? "") && jpeg) return { bytes, ext: "jpg" as const };
  if (input.mimeType === "image/webp" && ext === "webp" && webp) return { bytes, ext: "webp" as const };
  return invalid("Screenshot must be a PNG, JPEG, or WebP image with matching file type and content.");
}

/** Fixed windows, bounded memory, and a process-wide storage budget. Both the
 * signed device and trusted IP identity participate; deleting cookies cannot
 * bypass the IP budget. Only hashes, counts and expiry times are retained. */
export class PaymentProofUploadLimiter {
  private buckets = new Map<string, { count: number; expires: number }>();
  constructor(private readonly capacity = 5000) {}
  claim(identity: ReviewIdentity, now = Date.now()) {
    this.buckets.forEach((bucket, key) => { if (bucket.expires <= now) this.buckets.delete(key); });
    const limits = [
      { key: `device:short:${identity.deviceHash}`, max: 6, window: 10 * 60_000 },
      { key: `device:day:${identity.deviceHash}`, max: 20, window: 24 * 60 * 60_000 },
      ...identity.keys.flatMap(key => [
        { key: `identity:short:${key}`, max: 20, window: 10 * 60_000 },
        { key: `identity:day:${key}`, max: 80, window: 24 * 60 * 60_000 },
      ]),
      { key: "global:hour", max: 200, window: 60 * 60_000 },
    ];
    const missing = limits.filter(limit => !this.buckets.has(limit.key)).length;
    if (this.buckets.size + missing > this.capacity || limits.some(limit => (this.buckets.get(limit.key)?.count ?? 0) >= limit.max)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many payment screenshot uploads. Please try again later." });
    }
    for (const limit of limits) {
      const bucket = this.buckets.get(limit.key) ?? { count: 0, expires: now + limit.window };
      bucket.count++;
      this.buckets.set(limit.key, bucket);
    }
  }
}
const proofUploadLimiter = new PaymentProofUploadLimiter();
export async function uploadReviewPaymentProof(input: z.infer<typeof paymentProofUploadSchema>, identity: ReviewIdentity) {
  proofUploadLimiter.claim(identity);
  const { bytes, ext } = validatePaymentProof(input);
  try {
    const { url } = await storagePut(`review-payment-proofs/${randomUUID()}.${ext}`, bytes, input.mimeType);
    return { receiptUrl: url };
  } catch {
    // Do not expose storage credentials, presigned URLs or image payloads.
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Screenshot upload failed. Please try again." });
  }
}

export const reviewAudioMimeSchema = z.string().refine(value => ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "audio/m4a"].includes(value), "Only MP3, WAV, and M4A audio MIME types are accepted.");
export function validateReviewAudioUpload(input: { fileName: string; mimeType: string; fileBase64: string }) {
  const ext = extension(input.fileName);
  const types: Record<string, string[]> = { mp3: ["audio/mpeg", "audio/mp3"], wav: ["audio/wav", "audio/x-wav", "audio/wave"], m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a"] };
  if (!ext || !types[ext]?.includes(input.mimeType)) invalid("Only MP3, WAV, and M4A audio files with matching MIME types are accepted.");
  const bytes = decodeStrictBase64(input.fileBase64, MAX_AUDIO_BYTES);
  const mp3 = bytes.length >= 3 && (bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 6) !== 0));
  const wav = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE";
  const m4a = bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp";
  if (!(ext === "mp3" ? mp3 : ext === "wav" ? wav : m4a)) invalid("Audio content does not match its declared file type.");
  return { bytes, ext };
}
export function validateReviewAudioReference(fileKey: string, fileUrl: string) {
  if (!fileKey || fileKey.length > 512 || /[\s\\\u0000-\u001f]/.test(fileKey) || fileKey.split("/").some(part => part === ".." || part === ".")) invalid("Invalid uploaded audio file key.");
  let pathname: string;
  if (/^\/manus-storage\//.test(fileUrl)) {
    if (/[?#\\\s]/.test(fileUrl) || fileUrl.includes("%")) invalid("Invalid uploaded audio URL.");
    pathname = fileUrl;
  } else {
    try {
      const url = new URL(fileUrl);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) invalid("Invalid uploaded audio URL.");
      pathname = url.pathname;
    } catch { return invalid("Invalid uploaded audio URL."); }
  }
  const ext = extension(fileKey);
  if (!ext || !["mp3", "wav", "m4a"].includes(ext) || extension(pathname) !== ext) invalid("Only MP3, WAV, and M4A audio URLs are accepted.");
}

export function sanitizePublicReviewSubmission<T extends object>(song: T) {
  return { ...song, paymentMethod: null, contactInfo: null, cashappPaymentReceiptUrl: null, stripePaymentSessionId: null, notes: null };
}
