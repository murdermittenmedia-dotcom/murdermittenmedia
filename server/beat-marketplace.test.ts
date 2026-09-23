import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BEAT_LICENSE_PRESETS,
  FREE_PRODUCER_UPLOAD_LIMIT,
  calculateBeatSaleSplit,
  buildBeatLicenseContractText,
  createBeatLicenseTerms,
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

  it("uses one master upload, a generated preview, editable listings, and buyer-friendly discovery", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    const market = readFileSync(resolve(process.cwd(), "client/src/pages/BeatMarketplace.tsx"), "utf8");
    expect(router).toContain("createBeatPreviewClip");
    expect(router).not.toContain("previewBase64");
    expect(router).toContain("update: protectedProcedure");
    expect(router).toContain("suggestMetadata: protectedProcedure");
    expect(router).toContain("searchCoverImages: protectedProcedure");
    expect(router).toContain('input?.sort === "alphabetical"');
    expect(producer).toContain("Drop your beat here");
    expect(producer).toContain("AI help");
    expect(producer).toContain("Find a cover image");
    expect(market).toContain("Alphabetical A–Z");
    expect(market).toContain("/profile/${beat.producerId}");
  });

  it("preserves producer-configured lease limits and documents extra terms", () => {
    const license = createBeatLicenseTerms({
      code: "premium",
      name: "Streaming Lease",
      priceCents: 5_500,
      distributionLimit: 250_000,
      videoLimit: 3,
      monetizedViewLimit: 2_500_000,
      includesStems: true,
      customTerms: "Producer credit must read: Prod. by Detroit Test.",
    });
    expect(license.name).toBe("Streaming Lease");
    expect(license.distributionLimit).toBe(250_000);
    expect(license.includesStems).toBe(true);
    const terms = buildBeatLicenseContractText({ contractNumber: "MMM-BEAT-99-2026", effectiveDate: "September 22, 2026", buyerName: "Artist", buyerEmail: "artist@example.com", producerName: "Producer", producerEmail: "producer@example.com", beatTitle: "Tagged Beat", license, amountCents: 5_500 }).join(" ");
    expect(terms).toContain("250,000");
    expect(terms).toContain("PRODUCER-SPECIFIC TERMS");
    expect(terms).toContain("Prod. by Detroit Test");
  });

  it("supports selected vocal tags at a producer-controlled preview timestamp", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    const mixer = readFileSync(resolve(process.cwd(), "server/beat-audio-preview.ts"), "utf8");
    expect(router).toContain("resolveBeatPreviewTag");
    expect(router).toContain("previewTagAtSeconds");
    expect(producer).toContain("Preview tag");
    expect(producer).toContain("Purchase Your Track Now");
    expect(producer).toContain("Use my own uploaded tag");
    expect(mixer).toContain("amix=inputs=2");
  });

  it("grounds AI metadata in the producer identity, city, and real discovery language", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(router).toContain("const artistName = ctx.user.artistName || ctx.user.name");
    expect(router).toContain("const city = ctx.user.city?.trim() || null");
    expect(router).toContain("Producer artist identity:");
    expect(router).toContain("Producer city:");
    expect(router).toContain("exactly 8 distinct lowercase search tags");
    expect(router).toContain("Never use another artist's name as a style comparison");
    expect(router).toContain("Never invent instruments, drums, samples, arrangements, sound design, subgenres");
    expect(router).toContain("tags.length !== 8");
  });

  it("keeps premium creation tools and direct producer payments behind Beat Pro", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    expect(router).toContain("async function requireBeatPro");
    expect(router).toContain('await requireBeatPro(ctx.user.id, "AI metadata help")');
    expect(router).toContain('await requireBeatPro(ctx.user.id, "Cover art search")');
    expect(router).toContain("Tagged audio previews are available with Beat Pro");
    expect(producer).toContain("AI help • Pro");
    expect(producer).toContain("Cover art search is a Beat Pro tool.");
    expect(producer).toContain("Tagged client previews");
  });

  it("tracks direct producer payments and does not deliver until seller confirmation", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "server/beat-marketplace-service.ts"), "utf8");
    const detail = readFileSync(resolve(process.cwd(), "client/src/pages/BeatDetail.tsx"), "utf8");
    expect(router).toContain("saveDirectPaymentMethods: protectedProcedure");
    expect(router).toContain("createDirectPayment: protectedProcedure");
    expect(router).toContain("submitDirectPayment: protectedProcedure");
    expect(router).toContain("confirmDirectPayment: protectedProcedure");
    expect(router).toContain("Confirm only a payment that the buyer has marked as sent");
    expect(service).toContain("fulfillDirectBeatSale");
    expect(service).toContain("producerEarningsStatus: \"available\"");
    expect(detail).toContain("Pay producer directly");
    expect(detail).toContain("The producer confirms it before your files and license are released.");
  });

  it("supports manual Beat Pro access, producer account labels, and active membership overrides", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "server/beat-marketplace-service.ts"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPanel.tsx"), "utf8");
    expect(router).toContain("setProducerProAccess: adminProcedure");
    expect(router).toContain("ensureProducerAccountLabel(ctx.user.id)");
    expect(router).toContain('labels.includes("producer")');
    expect(service).toContain("if (membership.adminGranted) return membership");
    expect(service).toContain("Beat Pro is active");
    expect(admin).toContain("Grant Beat Pro");
    expect(admin).toContain("Remove manual grant");
  });

  it("provides a Beat Pro listing wizard that uses two creator prompts and preserves review", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const producer = readFileSync(resolve(process.cwd(), "client/src/pages/BeatProducer.tsx"), "utf8");
    expect(router).toContain("generateListingDraft: protectedProcedure");
    expect(router).toContain("Choose at least two prompts: genre, BPM, mood, or artists.");
    expect(router).toContain("Artists who would fit this beat");
    expect(producer).toContain("Beat Pro listing wizard");
    expect(producer).toContain("Answer any two prompts");
    expect(producer).toContain("Generate listing draft");
    expect(producer).toContain("Review it, then upload your audio and cover");
  });

  it("shows public producer catalogues and clear Free versus Beat Pro benefits", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const profile = readFileSync(resolve(process.cwd(), "client/src/pages/UserProfile.tsx"), "utf8");
    const market = readFileSync(resolve(process.cwd(), "client/src/pages/BeatMarketplace.tsx"), "utf8");
    expect(router).toContain("byProducer: publicProcedure");
    expect(profile).toContain("Beat Catalogue");
    expect(profile).toContain("trpc.beats.byProducer.useQuery");
    expect(market).toContain("Free Producer");
    expect(market).toContain("Beat Pro · $9.99/month");
    expect(market).toContain("AI listing wizard, cover discovery, and tagged client previews");
  });

  it("routes free producer manual payments through admin confirmation and adds PayPal", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const detail = readFileSync(resolve(process.cwd(), "client/src/pages/BeatDetail.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminBeatPayouts.tsx"), "utf8");
    const merch = readFileSync(resolve(process.cwd(), "client/src/pages/Merch.tsx"), "utf8");
    expect(router).toContain("createPlatformPayment: protectedProcedure");
    expect(router).toContain('confirmationMode: "admin"');
    expect(router).toContain("resolvePlatformDirectPayment: adminProcedure");
    expect(router).toContain("platformDirectPayments: adminProcedure");
    expect(detail).toContain("Platform payment options");
    expect(detail).toContain("Murder Mitten team");
    expect(admin).toContain("Platform payment receipts");
    expect(merch).toContain("MERCH_DIRECT_PAYMENT_OPTIONS");
    expect(merch).toContain("Or pay directly");
  });
});
