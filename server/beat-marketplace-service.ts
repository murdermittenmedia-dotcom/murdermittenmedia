import Stripe from "stripe";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  beatContracts,
  beatLicenses,
  beatProducerMemberships,
  beatSales,
  marketplaceBeats,
  users,
} from "../drizzle/schema";
import { buildBeatLicensePdf } from "./beat-contract-pdf";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { getBeatLicensePreset, getMonthStart } from "../shared/beat-marketplace";

export async function getActiveBeatProducerMembership(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [membership] = await db.select().from(beatProducerMemberships)
    .where(eq(beatProducerMemberships.userId, userId)).limit(1);
  if (!membership || membership.status !== "active") return null;
  if (membership.currentPeriodEnd && membership.currentPeriodEnd.getTime() <= Date.now()) return null;
  return membership;
}

export async function getBeatProducerPlan(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const membership = await getActiveBeatProducerMembership(userId);
  const monthStart = getMonthStart();
  const rows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceBeats)
    .where(and(eq(marketplaceBeats.producerId, userId), gte(marketplaceBeats.createdAt, monthStart)));
  return {
    isPro: !!membership,
    membership,
    uploadsThisMonth: Number(rows[0]?.count ?? 0),
    monthStart,
  };
}

export async function fulfillBeatProducerSubscription(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "beat_producer_pro") return null;
  const userId = Number(session.metadata.user_id);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid Beat Pro checkout metadata");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  let currentPeriodEnd: Date | null = null;
  if (subscriptionId) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription & { current_period_end?: number };
    if (typeof subscription.current_period_end === "number") currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  }
  const [existing] = await db.select().from(beatProducerMemberships)
    .where(eq(beatProducerMemberships.userId, userId)).limit(1);
  const values = {
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
    status: "active" as const,
    currentPeriodEnd,
  };
  if (existing) {
    await db.update(beatProducerMemberships).set(values)
      .where(eq(beatProducerMemberships.id, existing.id));
  } else {
    await db.insert(beatProducerMemberships).values({ userId, ...values });
  }
  return { userId, subscriptionId };
}

export async function updateBeatProducerSubscription(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active" as const
    : subscription.status === "past_due"
      ? "past_due" as const
      : "canceled" as const;
  await db.update(beatProducerMemberships).set({
    status,
    currentPeriodEnd: typeof periodEnd === "number" ? new Date(periodEnd * 1000) : null,
  }).where(eq(beatProducerMemberships.stripeSubscriptionId, subscription.id));
}

export async function fulfillBeatSaleFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.kind !== "beat_license") return null;
  if (session.payment_status !== "paid") throw new Error("Beat checkout is not paid");
  const saleId = Number(session.metadata.sale_id);
  const buyerId = Number(session.metadata.buyer_id);
  if (!Number.isInteger(saleId) || !Number.isInteger(buyerId)) throw new Error("Invalid beat checkout metadata");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [sale] = await db.select().from(beatSales).where(eq(beatSales.id, saleId)).limit(1);
  if (!sale || sale.stripeCheckoutSessionId !== session.id || sale.buyerId !== buyerId) throw new Error("Beat sale does not match checkout session");

  const [existingContract] = await db.select().from(beatContracts).where(eq(beatContracts.saleId, sale.id)).limit(1);
  if (sale.status === "paid" && existingContract) return { sale, contract: existingContract, alreadyFulfilled: true };

  const [beatRows, licenseRows, buyerRows, producerRows] = await Promise.all([
    db.select().from(marketplaceBeats).where(eq(marketplaceBeats.id, sale.beatId)).limit(1),
    db.select().from(beatLicenses).where(eq(beatLicenses.id, sale.licenseId)).limit(1),
    db.select().from(users).where(eq(users.id, sale.buyerId)).limit(1),
    db.select().from(users).where(eq(users.id, sale.producerId)).limit(1),
  ]);
  const beat = beatRows[0];
  const license = licenseRows[0];
  const buyer = buyerRows[0];
  const producer = producerRows[0];

  if (!beat || !license || !buyer || !producer) throw new Error("Beat fulfillment records are incomplete");
  if (sale.status !== "paid" && beat.status !== "active") throw new Error("This beat is no longer available for purchase");

  if (license.code === "exclusive") {
    const result = await db.update(marketplaceBeats).set({ status: "sold_exclusive", exclusiveSoldAt: new Date() })
      .where(and(eq(marketplaceBeats.id, beat.id), eq(marketplaceBeats.status, "active")));
    const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
    if (affectedRows === 0 && sale.status !== "paid") throw new Error("This exclusive beat was sold before this checkout completed");
  }

  await db.update(beatSales).set({
    status: "paid",
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : sale.stripePaymentIntentId,
    paidAt: sale.paidAt ?? new Date(),
  }).where(eq(beatSales.id, sale.id));

  let contract = existingContract;
  if (!contract) {
    const contractNumber = `MMM-BEAT-${sale.id}-${new Date().getUTCFullYear()}`;
    const pdf = buildBeatLicensePdf({
      contractNumber,
      effectiveDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      buyerName: sale.buyerName,
      buyerEmail: sale.buyerEmail ?? "",
      producerName: sale.producerNameSnapshot,
      producerEmail: producer.email ?? "",
      beatTitle: sale.beatTitleSnapshot,
      license: getBeatLicensePreset(license.code),
      amountCents: sale.amountCents,
    });
    const { key, url } = await storagePut(`beat-contracts/${sale.id}-${contractNumber}.pdf`, pdf, "application/pdf");
    const result = await db.insert(beatContracts).values({ saleId: sale.id, contractNumber, storageKey: key, documentUrl: url });
    const contractId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
    contract = { id: contractId, saleId: sale.id, contractNumber, storageKey: key, documentUrl: url, createdAt: new Date() };
    await db.update(beatSales).set({ contractId }).where(eq(beatSales.id, sale.id));
    await db.update(marketplaceBeats).set({ salesCount: sql`${marketplaceBeats.salesCount} + 1` }).where(eq(marketplaceBeats.id, beat.id));
  }
  return { sale: { ...sale, status: "paid" as const }, contract, alreadyFulfilled: false };
}

export async function markBeatSalePaymentReversed(paymentIntentId: string, status: "refunded" | "disputed") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(beatSales).set({ status }).where(eq(beatSales.stripePaymentIntentId, paymentIntentId));
}
