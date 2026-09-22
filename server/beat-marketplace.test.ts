import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BEAT_LICENSE_PRESETS,
  FREE_PRODUCER_UPLOAD_LIMIT,
  calculateBeatSaleSplit,
  buildBeatLicenseContractText,
  getProducerSharePercent,
  getProducerSettlementAvailableAt,
} from "../shared/beat-marketplace";
import { buildBeatLicensePdf } from "./beat-contract-pdf";

describe("Beat Marketplace plan and licensing rules", () => {
  it("keeps 80% for a free producer and 100% for Beat Pro", () => {
    expect(FREE_PRODUCER_UPLOAD_LIMIT).toBe(10);
    expect(getProducerSharePercent(false)).toBe(80);
    expect(calculateBeatSaleSplit(10_000, false)).toEqual({ producerSharePercent: 80, producerEarningsCents: 8_000, platformFeeCents: 2_000 });
    expect(calculateBeatSaleSplit(10_000, true)).toEqual({ producerSharePercent: 100, producerEarningsCents: 10_000, platformFeeCents: 0 });
  });

  it("keeps producer earnings pending for Stripe availability with a five-day floor and seven-day fallback", () => {
    const paidAt = new Date("2026-09-22T12:00:00.000Z");
    expect(getProducerSettlementAvailableAt(paidAt).toISOString()).toBe("2026-09-29T12:00:00.000Z");
    expect(getProducerSettlementAvailableAt(paidAt, new Date("2026-09-24T12:00:00.000Z")).toISOString()).toBe("2026-09-27T12:00:00.000Z");
    expect(getProducerSettlementAvailableAt(paidAt, new Date("2026-09-28T12:00:00.000Z")).toISOString()).toBe("2026-09-28T12:00:00.000Z");
  });

  it("provides human-readable lease terms and a real PDF document", () => {
    const snapshot = {
      contractNumber: "MMM-BEAT-42-2026",
      effectiveDate: "September 21, 2026",
      buyerName: "Artist Test",
      buyerEmail: "artist@example.com",
      producerName: "Producer Test",
      producerEmail: "producer@example.com",
      beatTitle: "Midnight in the Mitten",
      license: BEAT_LICENSE_PRESETS[0],
      amountCents: 2999,
    };
    const terms = buildBeatLicenseContractText(snapshot).join(" ");
    expect(terms).toContain("5,000");
    expect(terms).toContain("non-exclusive");
    expect(terms).toContain("not legal advice");
    const pdf = buildBeatLicensePdf(snapshot);
    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(pdf.toString()).toContain("MMM-BEAT-42-2026");
  });

  it("keeps master file fields out of public catalog response assembly", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(source).toContain("const { masterFileKey: _masterFileKey, masterFileUrl: _masterFileUrl, ...publicBeat }");
    expect(source).toContain("getDelivery: protectedProcedure");
    expect(source).toContain("eq(beatSales.buyerId, ctx.user.id)");
  });

  it("keeps Golden Wheel eligibility limited to merch checkout sessions", () => {
    const webhook = readFileSync(resolve(process.cwd(), "server/stripe-webhook.ts"), "utf8");
    expect(webhook).toContain("if (await isMerchCheckoutSession(session.id))");
    expect(webhook).toContain("Golden Wheel access is a first merch-order reward");
    expect(webhook).toContain("fulfillBeatSaleFromCheckoutSession");
  });

  it("uses settled earnings for marketplace cashouts and refreshes Stripe availability", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "server/beat-marketplace-service.ts"), "utf8");
    const webhook = readFileSync(resolve(process.cwd(), "server/stripe-webhook.ts"), "utf8");
    expect(router).toContain("getProducerSettlementLedger(ctx.user.id)");
    expect(router).toContain("exceeds settled marketplace earnings");
    expect(service).toContain("producerEarningsAvailableAt");
    expect(service).toContain("getProducerSettlementAvailableAt");
    expect(webhook).toContain('case "charge.succeeded"');
    expect(webhook).toContain("refreshBeatSaleSettlementFromPaymentIntent");
  });
});
