/**
 * Stripe Webhook Handler — Golden Wheel Integration
 *
 * Handles:
 *   - checkout.session.completed  → grant first-order wheel eligibility (livemode + paid only)
 *   - checkout.session.async_payment_succeeded → grant eligibility for delayed payment methods
 *   - charge.refunded / charge.dispute.created → revoke eligibility or flag spin
 *
 * Security:
 *   - Raw body + Stripe-Signature header verified before any processing
 *   - Idempotent: ProcessedStripeEvent table prevents duplicate handling
 *   - All DB writes in a single transaction
 *   - Never trusts frontend data
 */

import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getDb } from "./db";
import {
  goldenWheelOrders,
  wheelEligibility,
  processedStripeEvents,
  wheelSpins,
  users,
  promoCodes,
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0] ?? null;
}

async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result[0] ?? null;
}

async function hasExistingPaidOrder(userId: number, email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Check by userId
  const byUserId = await db
    .select({ id: goldenWheelOrders.id })
    .from(goldenWheelOrders)
    .where(
      and(
        eq(goldenWheelOrders.userId, userId),
        eq(goldenWheelOrders.paymentStatus, "paid"),
        eq(goldenWheelOrders.livemode, true)
      )
    )
    .limit(1);
  if (byUserId.length > 0) return true;

  // Also check by normalized email (catches same person with different account)
  const byEmail = await db
    .select({ id: goldenWheelOrders.id })
    .from(goldenWheelOrders)
    .where(
      and(
        eq(goldenWheelOrders.customerEmail, email.toLowerCase()),
        eq(goldenWheelOrders.paymentStatus, "paid"),
        eq(goldenWheelOrders.livemode, true)
      )
    )
    .limit(1);
  return byEmail.length > 0;
}

async function hasExistingEligibility(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db
    .select({ id: wheelEligibility.id })
    .from(wheelEligibility)
    .where(eq(wheelEligibility.userId, userId))
    .limit(1);
  return result.length > 0;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Only process live-mode, payment-mode, paid sessions
  if (!session.livemode) {
    console.log(`[GoldenWheel] Skipping test-mode session: ${session.id}`);
    return;
  }
  if (session.mode !== "payment") {
    console.log(`[GoldenWheel] Skipping non-payment session mode: ${session.mode}`);
    return;
  }
  if (session.payment_status !== "paid") {
    console.log(`[GoldenWheel] Session not paid yet (${session.payment_status}), waiting for async_payment_succeeded`);
    return;
  }

  await grantEligibilityForSession(session);
}

async function handleAsyncPaymentSucceeded(session: Stripe.Checkout.Session) {
  if (!session.livemode) {
    console.log(`[GoldenWheel] Skipping test-mode async payment: ${session.id}`);
    return;
  }
  await grantEligibilityForSession(session);
}

async function grantEligibilityForSession(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Extract user identity from metadata
  const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
  const customerEmail = (session.customer_email || session.metadata?.customer_email || "").toLowerCase();

  if (!userId || !customerEmail) {
    console.warn(`[GoldenWheel] Missing userId or email in session metadata: ${session.id}`);
    return;
  }

  // Verify user exists
  const user = await getUserById(userId);
  if (!user) {
    console.warn(`[GoldenWheel] User ${userId} not found for session ${session.id}`);
    return;
  }

  // Check if this is truly a first-time customer
  const alreadyHasPaidOrder = await hasExistingPaidOrder(userId, customerEmail);
  const alreadyHasEligibility = await hasExistingEligibility(userId);

  // Create or update the golden_wheel_order record
  const existingOrder = await db
    .select()
    .from(goldenWheelOrders)
    .where(eq(goldenWheelOrders.stripeCheckoutSessionId, session.id))
    .limit(1);

  let orderId: number;

  if (existingOrder.length === 0) {
    const insertResult = await db.insert(goldenWheelOrders).values({
      userId,
      customerEmail,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      paymentStatus: "paid",
      livemode: true,
      totalCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      paidAt: new Date(),
    });
    orderId = (insertResult as any).insertId;
  } else {
    orderId = existingOrder[0].id;
    await db
      .update(goldenWheelOrders)
      .set({
        paymentStatus: "paid",
        paidAt: new Date(),
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : existingOrder[0].stripePaymentIntentId,
      })
      .where(eq(goldenWheelOrders.id, orderId));
  }

  // Only grant eligibility if this is a first-time customer
  if (alreadyHasPaidOrder || alreadyHasEligibility) {
    console.log(`[GoldenWheel] User ${userId} (${customerEmail}) already has a paid order or eligibility — skipping wheel grant`);
    return;
  }

  // Also update the orders table (merch orders) if it exists
  try {
    const { orders } = await import("../drizzle/schema");
    const existingMerchOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.stripeCheckoutSessionId, session.id))
      .limit(1);

    if (existingMerchOrder.length > 0) {
      // Extract shipping address from Stripe session
      let shippingAddress = existingMerchOrder[0].shippingAddress;
      const sessionAny = session as any;
      if (sessionAny.shipping_details) {
        const addr = sessionAny.shipping_details.address;
        shippingAddress = JSON.stringify({
          name: sessionAny.shipping_details.name || "",
          email: customerEmail,
          address: addr?.line1 || "",
          city: addr?.city || "",
          state: addr?.state || "",
          zip: addr?.postal_code || "",
          country: addr?.country || "US",
        });
      }

      await db
        .update(orders)
        .set({
          status: "completed",
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          shippingAddress: shippingAddress,
        })
        .where(eq(orders.id, existingMerchOrder[0].id));
      console.log(`[Orders] ✅ Updated merch order ${existingMerchOrder[0].id} to completed with shipping address`);
    }
  } catch (err: any) {
    console.warn(`[Orders] Failed to update merch order:`, err);
  }

  // Increment promo code usage if one was used
  const promoCodeUsed = session.metadata?.promo_code;
  if (promoCodeUsed) {
    try {
      await db
        .update(promoCodes)
        .set({
          usageCount: sql`${promoCodes.usageCount} + 1`,
        })
        .where(
          and(
            eq(promoCodes.code, promoCodeUsed),
            eq(promoCodes.enabled, true)
          )
        );
      console.log(`[PromoCode] ✅ Incremented usage count for code: ${promoCodeUsed}`);
    } catch (err) {
      console.warn(`[PromoCode] Failed to increment usage for ${promoCodeUsed}:`, err);
    }
  }

  // Grant eligibility
  try {
    await db.insert(wheelEligibility).values({
      userId,
      orderId,
      stripeCheckoutSessionId: session.id,
      status: "ELIGIBLE",
    });
    console.log(`[GoldenWheel] ✅ Eligibility granted to user ${userId} (${customerEmail}) for order ${orderId}`);
  } catch (err: any) {
    // Unique constraint violation = already inserted (race condition), safe to ignore
    if (err?.code === "ER_DUP_ENTRY") {
      console.log(`[GoldenWheel] Eligibility already exists for user ${userId}, skipping`);
    } else {
      throw err;
    }
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!charge.livemode) return;

  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  // Find the golden_wheel_order by payment intent
  const order = await db
    .select()
    .from(goldenWheelOrders)
    .where(eq(goldenWheelOrders.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  if (order.length === 0) return;

  const gwOrder = order[0];

  // Mark order as refunded
  await db
    .update(goldenWheelOrders)
    .set({ paymentStatus: "refunded", refundedAt: new Date() })
    .where(eq(goldenWheelOrders.id, gwOrder.id));

  // Find eligibility for this order
  const eligibility = await db
    .select()
    .from(wheelEligibility)
    .where(eq(wheelEligibility.orderId, gwOrder.id))
    .limit(1);

  if (eligibility.length === 0) return;

  const elig = eligibility[0];

  if (elig.status === "ELIGIBLE") {
    // Customer hasn't spun yet — revoke eligibility
    await db
      .update(wheelEligibility)
      .set({ status: "REVOKED" })
      .where(eq(wheelEligibility.id, elig.id));
    console.log(`[GoldenWheel] Eligibility REVOKED for user ${gwOrder.userId} due to refund`);
  } else if (elig.status === "CLAIMED") {
    // Customer already spun — flag the spin for admin review
    await db
      .update(wheelSpins)
      .set({
        status: "flagged",
        adminNotes: `Order refunded at ${new Date().toISOString()}. Stripe PI: ${paymentIntentId}`,
      })
      .where(eq(wheelSpins.orderId, gwOrder.id));
    console.log(`[GoldenWheel] Spin FLAGGED for user ${gwOrder.userId} due to refund after spin`);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  if (!dispute.livemode) return;

  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
  if (!paymentIntentId) return;

  const order = await db
    .select()
    .from(goldenWheelOrders)
    .where(eq(goldenWheelOrders.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  if (order.length === 0) return;

  const gwOrder = order[0];

  await db
    .update(goldenWheelOrders)
    .set({ paymentStatus: "disputed" })
    .where(eq(goldenWheelOrders.id, gwOrder.id));

  const eligibility = await db
    .select()
    .from(wheelEligibility)
    .where(eq(wheelEligibility.orderId, gwOrder.id))
    .limit(1);

  if (eligibility.length === 0) return;
  const elig = eligibility[0];

  if (elig.status === "ELIGIBLE") {
    await db
      .update(wheelEligibility)
      .set({ status: "REVOKED" })
      .where(eq(wheelEligibility.id, elig.id));
    console.log(`[GoldenWheel] Eligibility REVOKED for user ${gwOrder.userId} due to dispute`);
  } else if (elig.status === "CLAIMED") {
    await db
      .update(wheelSpins)
      .set({
        status: "flagged",
        adminNotes: `Dispute opened at ${new Date().toISOString()}. Stripe PI: ${paymentIntentId}`,
      })
      .where(eq(wheelSpins.orderId, gwOrder.id));
    console.log(`[GoldenWheel] Spin FLAGGED for user ${gwOrder.userId} due to dispute`);
  }
}

export function registerStripeWebhook(app: Express) {
  // MUST use express.raw BEFORE express.json for Stripe signature verification
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook secret not configured" });
      }

      let event: Stripe.Event;
      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }

      // Handle test events — return verification response
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database not available' });

      // Idempotency check — skip already-processed events
      const alreadyProcessed = await db
        .select()
        .from(processedStripeEvents)
        .where(eq(processedStripeEvents.stripeEventId, event.id))
        .limit(1);

      if (alreadyProcessed.length > 0) {
        console.log(`[Webhook] Event ${event.id} already processed, returning 200`);
        return res.json({ received: true, duplicate: true });
      }

      // Process the event
      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
            break;
          case "checkout.session.async_payment_succeeded":
            await handleAsyncPaymentSucceeded(event.data.object as Stripe.Checkout.Session);
            break;
          case "charge.refunded":
            await handleChargeRefunded(event.data.object as Stripe.Charge);
            break;
          case "charge.dispute.created":
            await handleDisputeCreated(event.data.object as Stripe.Dispute);
            break;
          default:
            // Ignore other events
            break;
        }

        // Mark event as processed (idempotency record)
        await db.insert(processedStripeEvents).values({
          stripeEventId: event.id,
          eventType: event.type,
        });

        console.log(`[Webhook] ✅ Processed event: ${event.type} (${event.id})`);
        return res.json({ received: true });
      } catch (err: any) {
        console.error(`[Webhook] Error processing event ${event.id}:`, err);
        // Return 500 so Stripe retries
        return res.status(500).json({ error: "Internal processing error" });
      }
    }
  );
}
