import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { reviewAddOnPayments, reviewSubmissions } from "../drizzle/schema";
import { getDb, confirmSkipPayment } from "./db";
import { mutateReviewQueue } from "./review-transport";

/** Call only with a session retrieved from Stripe or a signature-verified event. */
export async function fulfillReviewAddOn(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [payment] = await db.select().from(reviewAddOnPayments).where(eq(reviewAddOnPayments.stripeSessionId, session.id)).limit(1);
  if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "This add-on checkout was not found." });
  if (session.mode !== "payment" || session.payment_status !== "paid" || session.metadata?.kind !== "music_review_addon" || session.metadata.submission_id !== String(payment.submissionId) || session.metadata.addon_kind !== payment.kind || session.amount_total !== payment.amountCents || session.currency !== "usd") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe has not verified the expected add-on payment." });
  }
  let applied = false;
  await mutateReviewQueue(async () => {
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(reviewAddOnPayments).where(eq(reviewAddOnPayments.id, payment.id)).for("update");
      if (locked.appliedAt) return;
      await tx.update(reviewSubmissions).set({
        ...(payment.kind !== "full_song" ? { skippedLine: true } : {}),
        ...(payment.kind !== "skip" ? { fullSongRequested: true, paidSubmissionConfirmed: true } : {}),
      }).where(eq(reviewSubmissions.id, payment.submissionId));
      await tx.update(reviewAddOnPayments).set({ appliedAt: new Date() }).where(eq(reviewAddOnPayments.id, payment.id));
      applied = true;
    });
    // A retry repairs an interrupted priority handoff without granting credits,
    // restarting playback or inserting another submission.
    if (payment.kind !== "full_song") {
      const [song] = await db.select().from(reviewSubmissions).where(eq(reviewSubmissions.id, payment.submissionId)).limit(1);
      if (song && ["pending", "playing"].includes(song.status)) await confirmSkipPayment(song.id);
    }
  });
  return { success: true as const, submissionId: payment.submissionId, alreadyApplied: !applied };
}
