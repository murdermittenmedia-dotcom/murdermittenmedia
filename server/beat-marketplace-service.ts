import Stripe from "stripe";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  beatContracts,
  beatLicenses,
  beatProducerMemberships,
  beatPayoutRequests,
  beatSales,
  marketplaceBeats,
  users,
} from "../drizzle/schema";
import { buildBeatLicensePdf } from "./beat-contract-pdf";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { getBeatLicensePreset, getMonthStart, getProducerSettlementAvailableAt } from "../shared/beat-marketplace";

type StripeSettlementDetails = {
  balanceTransactionId: string | null;
  availableOn: Date | null;
};

async function getStripeSettlementDetails(paymentIntentId: string | null): Promise<StripeSettlementDetails> {
  if (!paymentIntentId) return { balanceTransactionId: null, availableOn: null };
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = paymentIntent.latest_charge as (Stripe.Charge & { balance_transaction?: string | Stripe.BalanceTransaction | null }) | string | null;
    if (!charge || typeof charge === "string") return { balanceTransactionId: null, availableOn: null };
    const balanceReference = charge.balance_transaction;
    if (!balanceReference) return { balanceTransactionId: null, availableOn: null };
    const transaction = typeof balanceReference === "string"
      ? await stripe.balanceTransactions.retrieve(balanceReference)
      : balanceReference;
    return {
      balanceTransactionId: transaction.id,
      availableOn: typeof transaction.available_on === "number" ? new Date(transaction.available_on * 1000) : null,
    };
  } catch (error) {
    console.warn("[Beat Marketplace] Stripe balance availability unavailable; using seven-day fallback", error);
    return { balanceTransactionId: null, availableOn: null };
  }
}

export async function getProducerSettlementLedger(producerId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Settlement is computed from Stripe's availability date. This lazy update keeps
  // the ledger correct even if no background process is running at the exact hour
  // a held balance becomes available.
  await db.update(beatSales).set({
    producerEarningsStatus: "available",
    producerEarningsSettledAt: now,
  }).where(and(
    eq(beatSales.producerId, producerId),
    eq(beatSales.status, "paid"),
    eq(beatSales.producerEarningsStatus, "pending"),
    lte(beatSales.producerEarningsAvailableAt, now),
  ));
  const [sales, payoutRequests] = await Promise.all([
    db.select().from(beatSales).where(eq(beatSales.producerId, producerId)),
    db.select().from(beatPayoutRequests).where(eq(beatPayoutRequests.producerId, producerId)),
  ]);
  const paidSales = sales.filter((sale) => sale.status === "paid");
  const settledSales = paidSales.filter((sale) => sale.producerEarningsAvailableAt && sale.producerEarningsAvailableAt.getTime() <= now.getTime());
  const pendingSales = paidSales.filter((sale) => !sale.producerEarningsAvailableAt || sale.producerEarningsAvailableAt.getTime() > now.getTime());
  const payoutReservations = payoutRequests.filter((request) => inArrayValue(request.status, ["pending", "approved", "paid"]));
  const reservedPayoutCents = payoutReservations.reduce((sum, request) => sum + request.amountCents, 0);
  const availableGrossCents = settledSales.reduce((sum, sale) => sum + sale.producerEarningsCents, 0);
  const nextAvailableAt = pendingSales.reduce<Date | null>((next, sale) => {
    if (!sale.producerEarningsAvailableAt) return next;
    if (!next || sale.producerEarningsAvailableAt.getTime() < next.getTime()) return sale.producerEarningsAvailableAt;
    return next;
  }, null);
  return {
    sales,
    totalEarnedCents: paidSales.reduce((sum, sale) => sum + sale.producerEarningsCents, 0),
    pendingCents: pendingSales.reduce((sum, sale) => sum + sale.producerEarningsCents, 0),
    availableGrossCents,
    availableCents: Math.max(0, availableGrossCents - reservedPayoutCents),
    reservedPayoutCents,
    paidOutCents: payoutRequests.filter((request) => request.status === "paid").reduce((sum, request) => sum + request.amountCents, 0),
    nextAvailableAt,
  };
}

function inArrayValue<T>(value: T, values: readonly T[]) {
  return values.includes(value);
}

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

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : sale.stripePaymentIntentId;
  const paidAt = sale.paidAt ?? new Date();
  const settlement = await getStripeSettlementDetails(paymentIntentId);
  const settlementAvailableAt = getProducerSettlementAvailableAt(paidAt, settlement.availableOn);
  await db.update(beatSales).set({
    status: "paid",
    stripePaymentIntentId: paymentIntentId,
    stripeBalanceTransactionId: settlement.balanceTransactionId,
    producerEarningsStatus: settlementAvailableAt.getTime() <= Date.now() ? "available" : "pending",
    producerEarningsAvailableAt: settlementAvailableAt,
    paidAt,
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
  return { sale: { ...sale, status: "paid" as const, producerEarningsAvailableAt: settlementAvailableAt }, contract, alreadyFulfilled: false };
}

export async function markBeatSalePaymentReversed(paymentIntentId: string, status: "refunded" | "disputed") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(beatSales).set({ status, producerEarningsStatus: "reversed" }).where(eq(beatSales.stripePaymentIntentId, paymentIntentId));
}

/** Refreshes an existing paid sale whenever Stripe sends a charge-success event. */
export async function refreshBeatSaleSettlementFromPaymentIntent(paymentIntentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [sale] = await db.select().from(beatSales).where(eq(beatSales.stripePaymentIntentId, paymentIntentId)).limit(1);
  if (!sale || sale.status !== "paid") return null;
  const settlement = await getStripeSettlementDetails(paymentIntentId);
  if (!settlement.availableOn || !sale.paidAt) return null;
  const availableAt = getProducerSettlementAvailableAt(sale.paidAt, settlement.availableOn);
  await db.update(beatSales).set({
    stripeBalanceTransactionId: settlement.balanceTransactionId,
    producerEarningsAvailableAt: availableAt,
    producerEarningsStatus: availableAt.getTime() <= Date.now() ? "available" : "pending",
  }).where(eq(beatSales.id, sale.id));
  return { saleId: sale.id, availableAt };
}
