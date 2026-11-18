import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasCashAppPaymentProof, hasManualPaymentProof, isManualPaymentReceiptUrl } from "../shared/music-review-paywall";
import type { TrpcContext } from "./_core/context";

const memory = vi.hoisted(() => ({
  song: {} as any, state: {} as any,
  write: vi.fn(), storage: vi.fn(), owned: vi.fn(), allowance: vi.fn(), limited: vi.fn(), transport: vi.fn(), approve: vi.fn(), identity: { day: "2026-11-17", deviceHash: "device", keys: ["device", "ip"] },
}));
vi.mock("./storage", () => ({ storagePut: (...args: any[]) => memory.storage(...args), storageGetSignedUrl: vi.fn() }));
vi.mock("./review-submission-identity", () => ({ getReviewIdentity: () => memory.identity }));
vi.mock("./review-submission-limit", () => ({
  getOwnedReviewSubmission: (...args: any[]) => memory.owned(...args), assertReviewSubmissionAllowance: (...args: any[]) => memory.allowance(...args),
  createLimitedReviewSubmission: (...args: any[]) => memory.limited(...args), getReviewSubmissionAllowance: vi.fn(), getDeviceReviewSubmissions: vi.fn(),
}));
vi.mock("./review-transport", () => ({ mutateReviewQueue: async (fn: any) => { memory.transport(); return fn(); }, executeReviewTransport: vi.fn() }));
vi.mock("./db", async importOriginal => ({
  ...await importOriginal<typeof import("./db")>(),
  getDb: async () => ({
    update: () => ({ set: (value: any) => ({ where: async () => { memory.write(value); Object.assign(memory.song, value); } }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [memory.song] }) }) }),
  }),
  getQueueState: async () => memory.state,
  getReviewQueueSnapshot: async () => ({ submissions: [memory.song], state: memory.state, currentPlaying: memory.song }),
  getReviewedSubmissions: async () => [memory.song],
  getOrCreateActiveMusicReviewSession: async () => ({ id: 1 }),
  approveReviewPayment: (...args: any[]) => memory.approve(...args),
}));
import { appRouter } from "./routers";
import { reviewSubmissionRouter } from "./review-submission-router";
import { MAX_PAYMENT_PROOF_BYTES, PaymentProofUploadLimiter, decodeStrictBase64, validatePaymentProof, validateReviewAudioReference, validateReviewAudioUpload } from "./review-payment-proof";

const uuid = "45c7f70f-2936-4a88-83f7-ae9d3d1da106";
const proof = `/manus-storage/review-payment-proofs/${uuid}_abcd1234.png`;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from([0,0,0,13]), Buffer.from("IHDR"), Buffer.alloc(13)]);
const jpg = Buffer.from([255,216,255,224,0,0,255,217]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([12,0,0,0]), Buffer.from("WEBPVP8 "), Buffer.alloc(4)]);
const audio = { fileName: "song.mp3", mimeType: "audio/mpeg", fileBase64: Buffer.from("ID3test-audio").toString("base64") };
const context = (admin = false): TrpcContext => ({ user: admin ? { id: 1, role: "admin", openId: "admin" } : null, req: { headers: {}, protocol: "https" }, res: {} }) as unknown as TrpcContext;
beforeEach(() => {
  vi.clearAllMocks();
  memory.song = { id: 11, userId: null, status: "pending", artistName: "Guest", songTitle: "Song", skippedLine: false, skipPaymentConfirmed: false, isPaidSubmission: false, paidSubmissionConfirmed: false, stripePaymentSessionId: "cs_original" };
  memory.state = { playbackMode: "90sec", fullSongPriceCents: 700 };
  memory.owned.mockImplementation(async () => memory.song);
  memory.limited.mockResolvedValue(11);
  memory.storage.mockImplementation(async (key: string) => ({ key: key.replace(/\.(\w+)$/, "_abcd1234.$1"), url: `/manus-storage/${key.replace(/\.(\w+)$/, "_abcd1234.$1")}` }));
});

describe("manual receipt and file validation", () => {
  it("allows only manual methods and receipt links or UUID upload paths while preserving strict legacy behavior", () => {
    for (const method of ["Cash App", "PayPal"]) {
      expect(hasManualPaymentProof(proof, method)).toBe(true);
      expect(hasManualPaymentProof("https://paypal.com/receipt/123", method)).toBe(true);
    }
    expect(hasCashAppPaymentProof("https://cash.app/receipt/123", "Cash App")).toBe(true);
    expect(hasCashAppPaymentProof(proof, "Cash App")).toBe(false);
    expect(hasCashAppPaymentProof("https://paypal.com/receipt/123", "PayPal")).toBe(false);
    expect(hasManualPaymentProof(proof, "Stripe")).toBe(false);
    for (const value of ["javascript:alert(1)", "//evil.test/proof", "/manus-storage/other.png", `/manus-storage/review-payment-proofs/${uuid}.svg`, `${proof}?x=1`, `/manus-storage/review-payment-proofs/../${uuid}.png`, "https://user:pass@example.com/receipt", "https://example.com/manus-storage/other.png", "https://", "not a receipt"]) expect(isManualPaymentReceiptUrl(value)).toBe(false);
  });
  it.each([["png", "image/png", png], ["jpeg", "image/jpeg", jpg], ["webp", "image/webp", webp]] as const)("accepts matching %s image signatures", (ext, mimeType, bytes) => {
    expect(validatePaymentProof({ fileName: `receipt.${ext}`, mimeType, imageBase64: bytes.toString("base64") }).bytes).toEqual(bytes);
  });
  it("rejects malformed/noncanonical base64, MIME mismatches, disguised SVG and oversized payloads", () => {
    for (const value of ["!!!!", "a===", "YWJj\n", "YR==", "data:image/png;base64,AAAA", ""]) expect(() => decodeStrictBase64(value, 100)).toThrow();
    expect(() => validatePaymentProof({ fileName: "proof.png", mimeType: "image/png", imageBase64: jpg.toString("base64") })).toThrow();
    expect(() => validatePaymentProof({ fileName: "proof.png", mimeType: "image/png", imageBase64: Buffer.from("<svg></svg>").toString("base64") })).toThrow();
    expect(() => decodeStrictBase64(Buffer.alloc(MAX_PAYMENT_PROOF_BYTES + 1).toString("base64"), MAX_PAYMENT_PROOF_BYTES)).toThrow();
  });
  it("accepts MP3 WAV M4A only, including reference URLs, and rejects renamed Ogg/WebM", () => {
    expect(validateReviewAudioUpload(audio).ext).toBe("mp3");
    expect(validateReviewAudioUpload({ fileName: "track.wav", mimeType: "audio/wav", fileBase64: Buffer.from("RIFF1234WAVEdata").toString("base64") }).ext).toBe("wav");
    expect(validateReviewAudioUpload({ fileName: "track.m4a", mimeType: "audio/mp4", fileBase64: Buffer.concat([Buffer.from([0,0,0,16]), Buffer.from("ftypM4A ")]).toString("base64") }).ext).toBe("m4a");
    for (const ext of ["ogg", "webm", "svg"]) {
      expect(() => validateReviewAudioUpload({ ...audio, fileName: `track.${ext}` })).toThrow();
      expect(() => validateReviewAudioReference(`queue/track.${ext}`, `https://example.com/track.${ext}`)).toThrow();
    }
    expect(() => validateReviewAudioUpload({ ...audio, fileBase64: Buffer.from("OggSrenamed").toString("base64") })).toThrow();
    expect(() => validateReviewAudioUpload({ ...audio, mimeType: "audio/webm" })).toThrow();
    expect(() => validateReviewAudioReference("queue/test.mp3", "/manus-storage/queue/test.mp3")).not.toThrow();
    expect(() => validateReviewAudioReference("queue/test.mp3", "javascript:test.mp3")).toThrow();
    expect(() => validateReviewAudioReference("queue/test.mp3", "https://example.com/test.webm")).toThrow();
  });
  it("rate limits the signed device, shared IP, global traffic and bounded map; windows expire", () => {
    const limiter = new PaymentProofUploadLimiter();
    for (let i = 0; i < 6; i++) limiter.claim(memory.identity, 1000);
    expect(() => limiter.claim(memory.identity, 1000)).toThrow("Too many");
    expect(() => limiter.claim(memory.identity, 1000 + 10 * 60_000)).not.toThrow();
    const sharedIp = new PaymentProofUploadLimiter();
    for (let i = 0; i < 20; i++) sharedIp.claim({ day: "today", deviceHash: `device${i}`, keys: [`device${i}`, "shared-ip"] }, 1000);
    expect(() => sharedIp.claim({ day: "today", deviceHash: "fresh-device", keys: ["fresh-device", "shared-ip"] }, 1000)).toThrow("Too many");
    expect(() => new PaymentProofUploadLimiter(1).claim(memory.identity)).toThrow("Too many");
    const global = new PaymentProofUploadLimiter();
    for (let i = 0; i < 200; i++) global.claim({ day: "today", deviceHash: `device${i}`, keys: [`device${i}`, `ip${i}`] }, 1000);
    expect(() => global.claim({ day: "today", deviceHash: "fresh", keys: ["fresh", "fresh-ip"] }, 1000)).toThrow("Too many");
  });
});

describe("manual payment backend APIs", () => {
  it("uploads anonymous proof to an unpredictable UUID namespace without storing original names or logging bytes", async () => {
    const result = await reviewSubmissionRouter.createCaller(context()).uploadPaymentProof({ fileName: "private-name.png", mimeType: "image/png", imageBase64: png.toString("base64") });
    expect(result.receiptUrl).toMatch(/^\/manus-storage\/review-payment-proofs\/[a-f0-9-]{36}_abcd1234\.png$/);
    expect(hasManualPaymentProof(result.receiptUrl, "PayPal")).toBe(true);
    expect(memory.storage.mock.calls[0][0]).not.toContain("private-name");
  });
  it.each(["Cash App", "PayPal"] as const)("keeps %s add-ons pending, uses owner checks and transport, and preserves Stripe references", async paymentMethod => {
    const result = await reviewSubmissionRouter.createCaller(context()).requestManualPayment({ submissionId: 11, kind: "full_song_skip", paymentMethod, receiptUrl: proof });
    expect(result).toEqual({ success: true, status: "pending_admin_approval", amountCents: 1700 });
    expect(memory.owned).toHaveBeenCalledWith(expect.anything(), memory.identity, 11);
    expect(memory.transport).toHaveBeenCalledOnce();
    expect(memory.song).toMatchObject({ fullSongRequested: true, skippedLine: true, skipPaymentConfirmed: false, paidSubmissionConfirmed: false, paymentMethod, cashappPaymentReceiptUrl: proof, stripePaymentSessionId: "cs_original", isPaidSubmission: false });
  });
  it("retains the legacy Cash App API", async () => {
    await reviewSubmissionRouter.createCaller(context()).requestCashApp({ submissionId: 11, kind: "skip", receiptUrl: "https://cash.app/receipt/123" });
    expect(memory.song).toMatchObject({ paymentMethod: "Cash App", skipPaymentConfirmed: false, paidSubmissionConfirmed: false });
  });
  it("rejects foreign ownership, wrong full-song mode, already-approved and unpaid-entry full-song bypass", async () => {
    const caller = reviewSubmissionRouter.createCaller(context());
    const request = { submissionId: 11, kind: "full_song" as const, paymentMethod: "PayPal" as const, receiptUrl: proof };
    memory.owned.mockRejectedValueOnce(new Error("not your device"));
    await expect(caller.requestManualPayment(request)).rejects.toThrow("not your device");
    memory.state.playbackMode = "full";
    await expect(caller.requestManualPayment(request)).rejects.toThrow("90-second mode only");
    memory.state.playbackMode = "90sec";
    memory.song.paidSubmissionConfirmed = true;
    await expect(caller.requestManualPayment(request)).rejects.toThrow("already approved");
    memory.song.paidSubmissionConfirmed = false; memory.song.isPaidSubmission = true;
    await expect(caller.requestManualPayment(request)).rejects.toThrow("paid entry must be approved");
    await expect(appRouter.createCaller(context(true)).queue.approvePayment({ id: 11, kind: "full_song" })).rejects.toThrow("Approve the paid entry");
    expect(memory.approve).not.toHaveBeenCalled(); expect(memory.write).not.toHaveBeenCalled();
  });
  it.each(["submit", "uploadAudio", "uploadTrack"] as const)("allows guest paid manual queue.%s within the unchanged device/IP allowance", async method => {
    memory.state.playbackMode = "paid_only";
    const common = { artistName: "Guest Artist Name", songTitle: "New song", paidSubmissionType: "reentry5" as const, paymentMethod: "PayPal", receiptUrl: proof };
    const queue = appRouter.createCaller(context()).queue;
    const result = method === "submit" ? await queue.submit({ ...common, submissionType: "youtube", youtubeUrl: "https://youtube.com/watch?v=example" }) : method === "uploadAudio" ? await queue.uploadAudio({ ...common, ...audio }) : await queue.uploadTrack({ ...common, fileKey: "queue/test.mp3", fileUrl: "/manus-storage/queue/test.mp3" });
    expect(result.success).toBe(true);
    expect(memory.allowance).toHaveBeenCalledWith(memory.identity);
    expect(memory.limited).toHaveBeenCalledWith(expect.objectContaining({ artistName: common.artistName, userId: null, isPaidSubmission: true, paidSubmissionConfirmed: false, skipPaymentConfirmed: false, cashappPaymentReceiptUrl: proof, paymentMethod: "PayPal" }), memory.identity);
  });
  it("requires guest artist name and valid manual proof, and never lets payment bypass quota", async () => {
    const queue = appRouter.createCaller(context()).queue;
    const request = { songTitle: "Song", submissionType: "youtube" as const, paidSubmissionType: "reentry5" as const, receiptUrl: proof, paymentMethod: "PayPal" };
    await expect(queue.submit(request)).rejects.toThrow("Enter an artist name");
    await expect(queue.submit({ ...request, artistName: "Guest", receiptUrl: "bad" })).rejects.toThrow("payment proof");
    memory.allowance.mockRejectedValueOnce(new Error("Daily limit reached: two"));
    await expect(queue.submit({ ...request, artistName: "Guest" })).rejects.toThrow("Daily limit reached");
    expect(memory.limited).not.toHaveBeenCalled();
  });
  it("validates and persists manual proof on the legacy optional-proof skip endpoint", async () => {
    const ctx = context(true); ctx.user!.role = "user"; memory.song.userId = 1;
    await appRouter.createCaller(ctx).queue.requestSkip({ submissionId: 11, paymentMethod: "PayPal", receiptUrl: proof });
    expect(memory.song).toMatchObject({ paymentMethod: "PayPal", cashappPaymentReceiptUrl: proof, skipPaymentConfirmed: false });
    memory.song.skippedLine = false;
    await expect(appRouter.createCaller(ctx).queue.requestSkip({ submissionId: 11, receiptUrl: "javascript:bad", paymentMethod: "PayPal" })).rejects.toThrow("valid Cash App or PayPal");
    await expect(appRouter.createCaller(ctx).queue.requestSkip({ submissionId: 11 })).resolves.toEqual({ success: true });
  });
  it("redacts proof, method, contact, notes and Stripe IDs from public live/history queries but preserves admin data", async () => {
    Object.assign(memory.song, { paymentMethod: "PayPal", cashappPaymentReceiptUrl: proof, contactInfo: "private@example.com", notes: "private note" });
    const queue = appRouter.createCaller(context()).queue;
    const safe = { paymentMethod: null, cashappPaymentReceiptUrl: null, stripePaymentSessionId: null, contactInfo: null, notes: null };
    const snapshot = await queue.getAll();
    expect(snapshot.submissions[0]).toMatchObject(safe); expect(snapshot.currentPlaying).toMatchObject(safe);
    expect((await queue.getReviewed())[0]).toMatchObject(safe);
    expect((await appRouter.createCaller(context(true)).queue.getAll()).submissions[0]).toMatchObject({ paymentMethod: "PayPal", cashappPaymentReceiptUrl: proof });
    expect((await appRouter.createCaller(context(true)).queue.getReviewed())[0]).toMatchObject({ contactInfo: "private@example.com", notes: "private note" });
  });
});
