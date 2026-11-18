import Stripe from "stripe";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { getReviewIdentity } from "./review-submission-identity";
import { getReviewSubmissionAllowance, getDeviceReviewSubmissions, getOwnedReviewSubmission } from "./review-submission-limit";
import { getDb, getQueueState } from "./db";
import { fulfillReviewAddOn } from "./review-addon-payment";
import { reviewAddOnPayments, reviewSubmissions } from "../drizzle/schema";
import { mutateReviewQueue } from "./review-transport";
import { getSkipLinePriceCents } from "./skip-payments";
import { isManualPaymentReceiptUrl, type MusicReviewManualPaymentMethod } from "../shared/music-review-paywall";
import { paymentProofUploadSchema, uploadReviewPaymentProof } from "./review-payment-proof";

const kindSchema = z.enum(["skip", "full_song", "full_song_skip"]);
const receiptSchema = z.string().trim().max(512).refine(isManualPaymentReceiptUrl, "Provide an HTTP(S) receipt link or an uploaded payment screenshot.");
const manualRequestSchema = z.object({ submissionId: z.number().int().positive(), kind: kindSchema, paymentMethod: z.enum(["Cash App", "PayPal"]), receiptUrl: receiptSchema });
export type ReviewAddOnKind = z.infer<typeof kindSchema>;
export function getReviewAddOnPrice(kind: ReviewAddOnKind, fullSongPriceCents: number) {
  return (kind !== "full_song" ? getSkipLinePriceCents("skip") : 0) + (kind !== "skip" ? Math.max(0, Math.round(fullSongPriceCents)) : 0);
}
function assertAvailable(song: { status: string; skipPaymentConfirmed: boolean; paidSubmissionConfirmed: boolean; isPaidSubmission?: boolean }, kind: ReviewAddOnKind) {
  if (!["pending", "playing"].includes(song.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "That track is no longer in the live queue." });
  if (kind !== "full_song" && song.skipPaymentConfirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "A line skip is already approved for that track." });
  if (kind !== "skip" && song.isPaidSubmission && !song.paidSubmissionConfirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "The paid entry must be approved before requesting a full-song add-on." });
  if (kind !== "skip" && song.paidSubmissionConfirmed) throw new TRPCError({ code: "BAD_REQUEST", message: "Full-song playback is already approved for that track." });
}
async function requestManualPayment(ctx: TrpcContext, input: { submissionId: number; kind: ReviewAddOnKind; paymentMethod: MusicReviewManualPaymentMethod; receiptUrl: string }) {
  let amountCents = 0;
  await mutateReviewQueue(async () => {
    const song = await getOwnedReviewSubmission(ctx, getReviewIdentity(ctx), input.submissionId);
    assertAvailable(song, input.kind);
    const state = await getQueueState();
    if (input.kind !== "skip" && state?.playbackMode !== "90sec") throw new TRPCError({ code: "BAD_REQUEST", message: "Full-song add-ons are offered in 90-second mode only." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await db.update(reviewSubmissions).set({
      ...(input.kind !== "full_song" ? { skippedLine: true, skipPaymentConfirmed: false } : {}),
      ...(input.kind !== "skip" ? { fullSongRequested: true, paidSubmissionConfirmed: false } : {}),
      cashappPaymentReceiptUrl: input.receiptUrl,
      paymentMethod: input.paymentMethod,
    }).where(eq(reviewSubmissions.id, song.id));
    amountCents = getReviewAddOnPrice(input.kind, state?.fullSongPriceCents ?? 500);
  });
  return { success: true as const, status: "pending_admin_approval" as const, amountCents };
}

export const reviewSubmissionRouter = router({
  allowance: publicProcedure.query(async ({ ctx }) => getReviewSubmissionAllowance(getReviewIdentity(ctx))),
  myTracks: publicProcedure.query(async ({ ctx }) => getDeviceReviewSubmissions(getReviewIdentity(ctx))),
  uploadPaymentProof: publicProcedure.input(paymentProofUploadSchema)
    .mutation(({ ctx, input }) => uploadReviewPaymentProof(input, getReviewIdentity(ctx))),
  requestManualPayment: publicProcedure.input(manualRequestSchema)
    .mutation(({ ctx, input }) => requestManualPayment(ctx, input)),
  requestCashApp: publicProcedure.input(z.object({ submissionId: z.number().int().positive(), kind: kindSchema, receiptUrl: receiptSchema }))
    .mutation(({ ctx, input }) => requestManualPayment(ctx, { ...input, paymentMethod: "Cash App" })),
  createCheckout: publicProcedure.input(z.object({ submissionId: z.number().int().positive(), kind: kindSchema, origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const song = await getOwnedReviewSubmission(ctx, getReviewIdentity(ctx), input.submissionId);
      assertAvailable(song, input.kind);
      const state = await getQueueState();
      if (input.kind !== "skip" && state?.playbackMode !== "90sec") throw new TRPCError({ code: "BAD_REQUEST", message: "Full-song add-ons are offered in 90-second mode only." });
      const origin = new URL(input.origin);
      const host = (ctx.req.headers.host ?? "").split(":")[0];
      if (!["murdermittenmedia.com", "www.murdermittenmedia.com", host].includes(origin.hostname) || !["https:", "http:"].includes(origin.protocol)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Return to the website to start checkout." });
      }
      const amountCents = getReviewAddOnPrice(input.kind, state?.fullSongPriceCents ?? 500);
      if (!amountCents) throw new TRPCError({ code: "BAD_REQUEST", message: "This upgrade is not currently a paid option." });
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
      const session = await stripe.checkout.sessions.create({
        mode: "payment", payment_method_types: ["card"], customer_email: ctx.user?.email ?? undefined,
        metadata: { kind: "music_review_addon", submission_id: String(song.id), addon_kind: input.kind },
        line_items: [{ price_data: { currency: "usd", unit_amount: amountCents, product_data: {
          name: input.kind === "skip" ? "Music Review — Line Skip" : input.kind === "full_song" ? "Music Review — Full Song" : "Music Review — Full Song + Line Skip",
          description: `${song.artistName} — ${song.songTitle}`,
        } }, quantity: 1 }],
        success_url: `${origin.origin}/review?review_addon_paid=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin.origin}/review?review_addon_canceled=true&submission_id=${song.id}`,
      });
      if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a checkout URL." });
      await (await getDb())!.insert(reviewAddOnPayments).values({ submissionId: song.id, stripeSessionId: session.id, kind: input.kind, amountCents });
      return { checkoutUrl: session.url };
    }),
  confirmCheckout: publicProcedure.input(z.object({ sessionId: z.string().min(10).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [payment] = await db.select().from(reviewAddOnPayments).where(eq(reviewAddOnPayments.stripeSessionId, input.sessionId)).limit(1);
      if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "This add-on checkout was not found." });
      await getOwnedReviewSubmission(ctx, getReviewIdentity(ctx), payment.submissionId);
      const session = await new Stripe(process.env.STRIPE_SECRET_KEY || "").checkout.sessions.retrieve(input.sessionId);
      return fulfillReviewAddOn(session);
    }),
});
